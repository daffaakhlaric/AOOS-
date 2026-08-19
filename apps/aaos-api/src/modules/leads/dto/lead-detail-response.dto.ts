import type { Conversation, Message } from "@aos/lead-store";

import type { LeadResponseDto } from "./lead-response.dto.js";

/**
 * `GET /api/v1/leads/:id` — `LeadResponseDto` plus the REAL conversation thread, per AAOS-W4B
 * coordinator note #2: `@aos/lead-store` persists no "Jessy summary" prose anywhere, so this DTO
 * deliberately carries only real fields — `conversation` is `@aos/lead-store`'s own `Conversation`
 * metadata (message counts, exchange milestones, current stage), and `messages` is the real
 * per-message thread (`MessageRepository.findByConversationId`), not a synthesized summary.
 * `conversation`/`messages` are `undefined` when the lead has no conversation yet (a lead created
 * without ever exchanging a WhatsApp message) — a real, expected state, not an error.
 */
export interface MessageResponseDto {
  readonly id: string;
  readonly direction: string;
  readonly messageType: string;
  readonly body?: string;
  readonly sentAt?: string;
  readonly createdAt: string;
  /**
   * AAOS-CHAT-ROOM-JESSY (coordinator note #2) — who authored an OUTGOING message: `"JESSY"` for
   * Jessy's own automated replies, `"SALES_HUMAN"` for a sales human's real reply, or
   * `"MANAGER_INTERVENTION"` for a manager sending "as Jessy" from the dashboard. `undefined` for
   * every INCOMING message (always the lead) and for any OUTGOING row that predates the
   * `sender_type` column's backfill.
   */
  readonly senderType?: string;
  readonly senderName?: string;
}

export interface ConversationSummaryResponseDto {
  readonly messageCount: number;
  readonly incomingCount: number;
  readonly outgoingCount: number;
  readonly currentStage: string;
  readonly lastIntent?: string;
  readonly status: string;
  readonly startedAt: string;
  readonly lastMessageAt: string;
}

export interface LeadDetailResponseDto extends LeadResponseDto {
  readonly conversation?: ConversationSummaryResponseDto;
  readonly messages: readonly MessageResponseDto[];
}

export function toMessageResponseDto(message: Message): MessageResponseDto {
  return {
    id: message.id.toString(),
    direction: message.direction,
    messageType: message.messageType,
    body: message.body,
    sentAt: message.sentAt?.toISOString(),
    createdAt: message.createdAt.toISOString(),
    senderType: message.senderType,
    senderName: message.senderName,
  };
}

export function toConversationSummaryResponseDto(
  conversation: Conversation,
): ConversationSummaryResponseDto {
  return {
    messageCount: conversation.messageCount,
    incomingCount: conversation.incomingCount,
    outgoingCount: conversation.outgoingCount,
    currentStage: conversation.currentStage,
    lastIntent: conversation.lastIntent,
    status: conversation.status,
    startedAt: conversation.startedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt.toISOString(),
  };
}
