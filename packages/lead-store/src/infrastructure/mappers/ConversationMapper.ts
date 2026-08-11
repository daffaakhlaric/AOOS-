import { BranchId } from "@aos/branch-manager";
import { err, ErrorCode, ok, type Result } from "@aos/common";
import { PhoneNumberId } from "@aos/whatsapp-connector";

import { Conversation, type ConversationStatus } from "../../domain/entities/Conversation.js";
import { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import { ConversationId } from "../../domain/value-objects/ConversationId.js";
import { LeadId } from "../../domain/value-objects/LeadId.js";

/** Exact shape of the `conversations` table (spec `001_initial_schema.sql`). */
export interface ConversationRow {
  readonly id: string;
  readonly lead_id: string;
  readonly branch_id: string;
  readonly waba_phone_number_id: string;
  readonly message_count: number;
  readonly incoming_count: number;
  readonly outgoing_count: number;
  readonly d1_count: number;
  readonly d2_count: number;
  readonly d3_count: number;
  readonly d5_count: number;
  readonly current_stage: string;
  readonly last_intent: string | null;
  readonly started_at: string;
  readonly last_message_at: string;
  readonly status: string;
}

/** Maps between `conversations` DB rows and the `Conversation` domain entity — field-by-field, both directions. */
export class ConversationMapper {
  static toDomain(row: ConversationRow): Result<Conversation, LeadStoreError> {
    const idResult = ConversationId.create(row.id);
    if (!idResult.ok) {
      return err(new LeadStoreError(idResult.error.message, { code: ErrorCode.VALIDATION_ERROR }));
    }
    const leadIdResult = LeadId.create(row.lead_id);
    if (!leadIdResult.ok) {
      return err(
        new LeadStoreError(leadIdResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    const wabaIdResult = PhoneNumberId.create(row.waba_phone_number_id);
    if (!wabaIdResult.ok) {
      return err(
        new LeadStoreError(wabaIdResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    if (!Object.values(BranchId).includes(row.branch_id as BranchId)) {
      return err(
        new LeadStoreError(`Conversation.branch_id is not a valid BranchId: "${row.branch_id}"`, {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }
    if (row.status !== "ACTIVE" && row.status !== "CLOSED") {
      return err(
        new LeadStoreError(
          `Conversation.status must be ACTIVE or CLOSED, received: "${row.status}"`,
          {
            code: ErrorCode.VALIDATION_ERROR,
          },
        ),
      );
    }

    const conversationResult = Conversation.create({
      id: idResult.value,
      leadId: leadIdResult.value,
      branchId: row.branch_id as BranchId,
      wabaPhoneNumberId: wabaIdResult.value,
      messageCount: row.message_count,
      incomingCount: row.incoming_count,
      outgoingCount: row.outgoing_count,
      milestones: {
        d1: row.d1_count === 1 ? 1 : 0,
        d2: row.d2_count === 1 ? 1 : 0,
        d3: row.d3_count === 1 ? 1 : 0,
        d5: row.d5_count === 1 ? 1 : 0,
      },
      currentStage: row.current_stage,
      lastIntent: row.last_intent ?? undefined,
      startedAt: new Date(row.started_at),
      lastMessageAt: new Date(row.last_message_at),
      status: row.status as ConversationStatus,
    });
    if (!conversationResult.ok) {
      return err(
        new LeadStoreError(conversationResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    return ok(conversationResult.value);
  }

  static toRow(conversation: Conversation): ConversationRow {
    return {
      id: conversation.id.toString(),
      lead_id: conversation.leadId.toString(),
      branch_id: conversation.branchId,
      waba_phone_number_id: conversation.wabaPhoneNumberId.toString(),
      message_count: conversation.messageCount,
      incoming_count: conversation.incomingCount,
      outgoing_count: conversation.outgoingCount,
      d1_count: conversation.milestones.d1,
      d2_count: conversation.milestones.d2,
      d3_count: conversation.milestones.d3,
      d5_count: conversation.milestones.d5,
      current_stage: conversation.currentStage,
      last_intent: conversation.lastIntent ?? null,
      started_at: conversation.startedAt.toISOString(),
      last_message_at: conversation.lastMessageAt.toISOString(),
      status: conversation.status,
    };
  }
}
