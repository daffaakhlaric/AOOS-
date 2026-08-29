import { BranchId } from "@aos/branch-manager";
import { err, ErrorCode, ok, type Result } from "@aos/common";
import { PhoneNumber, PhoneNumberId } from "@aos/whatsapp-connector";
import { z } from "zod";

import type { IConversationRepository } from "../../contracts/IConversationRepository.js";
import type { ILeadRepository } from "../../contracts/ILeadRepository.js";
import { Conversation } from "../../domain/entities/Conversation.js";
import { Lead } from "../../domain/entities/Lead.js";
import { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import type { LeadStoreEvents } from "../../domain/events/LeadStoreEvents.js";
import { ConversationId } from "../../domain/value-objects/ConversationId.js";
import { LeadId } from "../../domain/value-objects/LeadId.js";
import { LeadSource } from "../../domain/value-objects/LeadSource.js";
import { LeadStatus } from "../../domain/value-objects/LeadStatus.js";

export interface CreateLeadInput {
  readonly leadSource: LeadSource;
  readonly leadPhone: string;
  readonly branchId: BranchId;
  readonly wabaPhoneNumberId: string;
  readonly campaignId?: string;
  readonly adId?: string;
  readonly adAccountId?: string;
  readonly leadName?: string;
  readonly tenantId: string;
  readonly correlationId: string;
}

const CreateLeadInputSchema = z.object({
  leadSource: z.nativeEnum(LeadSource),
  leadPhone: z.string().min(1),
  branchId: z.nativeEnum(BranchId),
  wabaPhoneNumberId: z.string().min(1),
  campaignId: z.string().min(1).optional(),
  adId: z.string().min(1).optional(),
  adAccountId: z.string().min(1).optional(),
  leadName: z.string().min(1).optional(),
  tenantId: z.string().min(1),
  correlationId: z.string().min(1),
});

/**
 * Called when Clara starts a new conversation with a lead. Idempotent on `(leadPhone, branchId)`
 * — design resolution #5: if a lead already exists for that pair, returns it as `Ok` WITHOUT
 * inserting a duplicate or emitting `LeadCreated`. Only a genuine new insert emits the event.
 */
export class CreateLead {
  constructor(
    private readonly leadRepository: ILeadRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly events: LeadStoreEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: CreateLeadInput): Promise<Result<Lead, LeadStoreError>> {
    const parsed = CreateLeadInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new LeadStoreError(`CreateLead input validation failed: ${parsed.error.message}`, {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }

    const phoneResult = PhoneNumber.create(parsed.data.leadPhone);
    if (!phoneResult.ok) {
      return err(
        new LeadStoreError(phoneResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    const wabaIdResult = PhoneNumberId.create(parsed.data.wabaPhoneNumberId);
    if (!wabaIdResult.ok) {
      return err(
        new LeadStoreError(wabaIdResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }

    const existingResult = await this.leadRepository.findByPhoneAndBranch(
      phoneResult.value.toString(),
      parsed.data.branchId,
      parsed.data.tenantId,
    );
    if (!existingResult.ok) {
      return err(existingResult.error);
    }
    if (existingResult.value !== undefined) {
      return ok(existingResult.value);
    }

    const now = this.now();
    const leadResult = Lead.create({
      id: LeadId.generate(),
      tenantId: parsed.data.tenantId,
      leadSource: parsed.data.leadSource,
      campaignId: parsed.data.campaignId,
      adId: parsed.data.adId,
      adAccountId: parsed.data.adAccountId,
      leadPhone: phoneResult.value,
      leadName: parsed.data.leadName,
      branchId: parsed.data.branchId,
      wabaPhoneNumberId: wabaIdResult.value,
      status: LeadStatus.NEW,
      score: 0,
      temperature: LeadStatus.COLD,
      qualification: {
        budget: false,
        unit: false,
        area: false,
        payment: false,
        timeline: false,
        name: false,
      },
      broadcastCount: 0,
      recyclingArchived: false,
      syncedToMetaAudience: false,
      createdAt: now,
      updatedAt: now,
    });
    /* v8 ignore start -- score is always the hardcoded-valid literal 0 here, and tenantId is
       already validated non-empty by the Zod schema above, so Lead.create's only 2 failure modes
       can never trigger here. */
    if (!leadResult.ok) {
      return err(
        new LeadStoreError(leadResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    /* v8 ignore stop */

    const insertResult = await this.leadRepository.insert(leadResult.value);
    if (!insertResult.ok) {
      return err(insertResult.error);
    }

    const conversationResult = Conversation.create({
      id: ConversationId.generate(),
      leadId: insertResult.value.id,
      branchId: parsed.data.branchId,
      wabaPhoneNumberId: wabaIdResult.value,
      messageCount: 0,
      incomingCount: 0,
      outgoingCount: 0,
      milestones: { d1: 0, d2: 0, d3: 0, d5: 0 },
      currentStage: "GREETING",
      startedAt: now,
      lastMessageAt: now,
      status: "ACTIVE",
    });
    /* v8 ignore start -- every field above is either a hardcoded-valid literal or sourced from
       already-validated inputs (`parsed.data`, `wabaIdResult.value`, `insertResult.value.id`), so
       `Conversation.create`'s only failure mode (negative messageCount) can never trigger here. */
    if (!conversationResult.ok) {
      return err(
        new LeadStoreError(conversationResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    /* v8 ignore stop */
    const conversationInsertResult = await this.conversationRepository.insert(
      conversationResult.value,
    );
    if (!conversationInsertResult.ok) {
      return err(conversationInsertResult.error);
    }

    await this.events.publishLeadCreated({
      leadId: insertResult.value.id.toString(),
      leadPhone: phoneResult.value.toString(),
      branchId: parsed.data.branchId,
      leadSource: parsed.data.leadSource,
      campaignId: parsed.data.campaignId,
      adId: parsed.data.adId,
      tenantId: parsed.data.tenantId,
      correlationId: parsed.data.correlationId,
      occurredAt: now,
      version: "1.0",
    });

    return ok(insertResult.value);
  }
}
