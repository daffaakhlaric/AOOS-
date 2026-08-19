import { err, ErrorCode, ok, type Result } from "@aos/common";
import { z } from "zod";

import type { IConversationRepository } from "../../contracts/IConversationRepository.js";
import type { ILeadRepository } from "../../contracts/ILeadRepository.js";
import type { IMessageRepository } from "../../contracts/IMessageRepository.js";
import type { ExchangeMilestones } from "../../domain/entities/Conversation.js";
import {
  Message,
  type MessageContentType,
  type MessageDirection,
  type MessageSenderType,
} from "../../domain/entities/Message.js";
import { ConversationNotFoundError } from "../../domain/errors/ConversationNotFoundError.js";
import { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import type { LeadStoreEvents } from "../../domain/events/LeadStoreEvents.js";
import { ConversationId } from "../../domain/value-objects/ConversationId.js";
import { MessageId } from "../../domain/value-objects/MessageId.js";

export interface SaveMessageInput {
  readonly conversationId: string;
  readonly direction: MessageDirection;
  readonly messageType?: MessageContentType;
  readonly body?: string;
  readonly wamid?: string;
  readonly templateName?: string;
  readonly tenantId: string;
  readonly correlationId: string;
  /**
   * AAOS-CHAT-ROOM-JESSY — who authored an OUTGOING message. Callers persisting an INCOMING
   * message never set this (the lead is always the sender there); `aaos-api`'s
   * `POST /leads/:id/message`/`POST /leads/:id/intervene` set it to `"SALES_HUMAN"` /
   * `"MANAGER_INTERVENTION"` respectively, and the webhook path that saves Jessy's own automated
   * replies sets `"JESSY"`.
   */
  readonly senderType?: MessageSenderType;
  readonly senderName?: string;
}

const SaveMessageInputSchema = z.object({
  conversationId: z.string().min(1),
  direction: z.union([z.literal("INCOMING"), z.literal("OUTGOING")]),
  messageType: z
    .union([z.literal("TEXT"), z.literal("TEMPLATE"), z.literal("INTERACTIVE"), z.literal("IMAGE")])
    .default("TEXT"),
  body: z.string().optional(),
  wamid: z.string().optional(),
  templateName: z.string().optional(),
  tenantId: z.string().min(1),
  correlationId: z.string().min(1),
  senderType: z
    .union([z.literal("JESSY"), z.literal("SALES_HUMAN"), z.literal("MANAGER_INTERVENTION")])
    .optional(),
  senderName: z.string().optional(),
});

const MILESTONE_THRESHOLDS = [1, 2, 3, 5] as const;

/**
 * Called after every message (in or out). Design resolution #1 — the `dN_count` fields are
 * one-time milestone-reached flags, NOT per-message counters. The exact pairing algorithm:
 *
 *   exchangeCount = min(incomingCount, outgoingCount)
 *
 * i.e. an "exchange" is a COMPLETE incoming+outgoing round-trip. After recording this message,
 * `dN` flips from 0 to 1 (and only ever 0 to 1 — never back to 0) the first time `exchangeCount`
 * reaches `N`, for each `N` in `{1, 2, 3, 5}`. Example: 1 incoming + 1 outgoing → exchangeCount=1 →
 * d1=1. 2 incoming + 2 outgoing → exchangeCount=2 → d1=1, d2=1. Reaching exchangeCount=4 leaves d3
 * untouched (already 1); reaching exchangeCount=6 leaves d5 untouched (already 1).
 */
export class SaveMessage {
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly leadRepository: ILeadRepository,
    private readonly events: LeadStoreEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: SaveMessageInput): Promise<Result<Message, LeadStoreError>> {
    const parsed = SaveMessageInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new LeadStoreError(`SaveMessage input validation failed: ${parsed.error.message}`, {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }

    const conversationIdResult = ConversationId.create(parsed.data.conversationId);
    if (!conversationIdResult.ok) {
      return err(
        new LeadStoreError(conversationIdResult.error.message, {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }

    const conversationResult = await this.conversationRepository.findById(
      conversationIdResult.value,
    );
    if (!conversationResult.ok) {
      return err(conversationResult.error);
    }
    if (conversationResult.value === undefined) {
      return err(
        new ConversationNotFoundError(`Conversation not found: ${parsed.data.conversationId}`),
      );
    }
    const conversation = conversationResult.value;

    const now = this.now();
    const nextIncoming =
      parsed.data.direction === "INCOMING"
        ? conversation.incomingCount + 1
        : conversation.incomingCount;
    const nextOutgoing =
      parsed.data.direction === "OUTGOING"
        ? conversation.outgoingCount + 1
        : conversation.outgoingCount;
    const exchangeCount = Math.min(nextIncoming, nextOutgoing);
    const milestones = computeMilestones(conversation.milestones, exchangeCount);

    const updatedConversation = conversation.recordMessage(parsed.data.direction, milestones, now);
    const conversationUpdateResult = await this.conversationRepository.update(updatedConversation);
    if (!conversationUpdateResult.ok) {
      return err(conversationUpdateResult.error);
    }

    const messageResult = Message.create({
      id: MessageId.generate(),
      conversationId: conversationIdResult.value,
      leadId: conversation.leadId,
      direction: parsed.data.direction,
      messageType: parsed.data.messageType,
      body: parsed.data.body,
      wamid: parsed.data.wamid,
      templateName: parsed.data.templateName,
      sentAt: parsed.data.direction === "OUTGOING" ? now : undefined,
      createdAt: now,
      senderType: parsed.data.senderType,
      senderName: parsed.data.senderName,
    });
    /* v8 ignore start -- direction is already validated by the Zod schema above, so Message.create's
       only failure mode can never trigger here. */
    if (!messageResult.ok) {
      return err(
        new LeadStoreError(messageResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    /* v8 ignore stop */

    const insertResult = await this.messageRepository.insert(messageResult.value);
    if (!insertResult.ok) {
      return err(insertResult.error);
    }

    const leadResult = await this.leadRepository.findById(conversation.leadId);
    if (leadResult.ok && leadResult.value !== undefined) {
      const updatedLead = leadResult.value.withLastMessageAt(now);
      await this.leadRepository.update(updatedLead);
    }

    await this.events.publishConversationUpdated({
      conversationId: conversationIdResult.value.toString(),
      leadId: conversation.leadId.toString(),
      direction: parsed.data.direction,
      messageCount: updatedConversation.messageCount,
      tenantId: parsed.data.tenantId,
      correlationId: parsed.data.correlationId,
      occurredAt: now,
      version: "1.0",
    });

    return ok(insertResult.value);
  }
}

function computeMilestones(current: ExchangeMilestones, exchangeCount: number): ExchangeMilestones {
  const next: { d1: 0 | 1; d2: 0 | 1; d3: 0 | 1; d5: 0 | 1 } = { ...current };
  for (const threshold of MILESTONE_THRESHOLDS) {
    const key = `d${threshold}` as "d1" | "d2" | "d3" | "d5";
    if (next[key] === 0 && exchangeCount >= threshold) {
      next[key] = 1;
    }
  }
  return next;
}
