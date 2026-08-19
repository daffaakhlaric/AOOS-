import { err, ErrorCode, ok, type Result } from "@aos/common";

import {
  Message,
  type MessageContentType,
  type MessageDeliveryStatus,
  type MessageDirection,
  type MessageSenderType,
} from "../../domain/entities/Message.js";
import { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import { ConversationId } from "../../domain/value-objects/ConversationId.js";
import { LeadId } from "../../domain/value-objects/LeadId.js";
import { MessageId } from "../../domain/value-objects/MessageId.js";

const VALID_TYPES: ReadonlySet<string> = new Set(["TEXT", "TEMPLATE", "INTERACTIVE", "IMAGE"]);
const VALID_DELIVERY_STATUSES: ReadonlySet<string> = new Set([
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
]);
const VALID_SENDER_TYPES: ReadonlySet<string> = new Set([
  "JESSY",
  "SALES_HUMAN",
  "MANAGER_INTERVENTION",
]);

/** Exact shape of the `messages` table (spec `001_initial_schema.sql` + `004_message_sender.sql`). */
export interface MessageRow {
  readonly id: string;
  readonly conversation_id: string;
  readonly lead_id: string;
  readonly direction: string;
  readonly message_type: string;
  readonly body: string | null;
  readonly wamid: string | null;
  readonly template_name: string | null;
  readonly delivery_status: string | null;
  readonly sent_at: string | null;
  readonly delivered_at: string | null;
  readonly read_at: string | null;
  readonly created_at: string;
  /** AAOS-CHAT-ROOM-JESSY (`004_message_sender.sql`) — `null` for INCOMING rows and for any OUTGOING row predating the backfill. */
  readonly sender_type: string | null;
  readonly sender_name: string | null;
}

/** Maps between `messages` DB rows and the `Message` domain entity — field-by-field, both directions. */
export class MessageMapper {
  static toDomain(row: MessageRow): Result<Message, LeadStoreError> {
    const idResult = MessageId.create(row.id);
    if (!idResult.ok) {
      return err(new LeadStoreError(idResult.error.message, { code: ErrorCode.VALIDATION_ERROR }));
    }
    const conversationIdResult = ConversationId.create(row.conversation_id);
    if (!conversationIdResult.ok) {
      return err(
        new LeadStoreError(conversationIdResult.error.message, {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }
    const leadIdResult = LeadId.create(row.lead_id);
    if (!leadIdResult.ok) {
      return err(
        new LeadStoreError(leadIdResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    if (row.direction !== "INCOMING" && row.direction !== "OUTGOING") {
      return err(
        new LeadStoreError(
          `Message.direction must be INCOMING or OUTGOING, received: "${row.direction}"`,
          {
            code: ErrorCode.VALIDATION_ERROR,
          },
        ),
      );
    }
    if (!VALID_TYPES.has(row.message_type)) {
      return err(
        new LeadStoreError(`Message.message_type is not valid: "${row.message_type}"`, {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }
    if (row.delivery_status !== null && !VALID_DELIVERY_STATUSES.has(row.delivery_status)) {
      return err(
        new LeadStoreError(`Message.delivery_status is not valid: "${row.delivery_status}"`, {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }
    // Loose `!= null` (not strict `!== null`): real Supabase rows always return an explicit
    // `null`, but several callers across this monorepo (e.g. `apps/aaos-api`'s own hand-rolled
    // `SupabaseClientLike` test doubles) seed rows that omit `sender_type` entirely — `undefined`,
    // not `null`. Both mean "no sender_type set", so both must be tolerated the same way.
    if (row.sender_type != null && !VALID_SENDER_TYPES.has(row.sender_type)) {
      return err(
        new LeadStoreError(`Message.sender_type is not valid: "${row.sender_type}"`, {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }

    const messageResult = Message.create({
      id: idResult.value,
      conversationId: conversationIdResult.value,
      leadId: leadIdResult.value,
      direction: row.direction as MessageDirection,
      messageType: row.message_type as MessageContentType,
      body: row.body ?? undefined,
      wamid: row.wamid ?? undefined,
      templateName: row.template_name ?? undefined,
      deliveryStatus: (row.delivery_status ?? undefined) as MessageDeliveryStatus | undefined,
      sentAt: row.sent_at !== null ? new Date(row.sent_at) : undefined,
      deliveredAt: row.delivered_at !== null ? new Date(row.delivered_at) : undefined,
      readAt: row.read_at !== null ? new Date(row.read_at) : undefined,
      createdAt: new Date(row.created_at),
      senderType: (row.sender_type ?? undefined) as MessageSenderType | undefined,
      senderName: row.sender_name ?? undefined,
    });
    /* v8 ignore start -- direction is already validated above, so Message.create's only failure
       mode can never trigger here. */
    if (!messageResult.ok) {
      return err(
        new LeadStoreError(messageResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    /* v8 ignore stop */
    return ok(messageResult.value);
  }

  static toRow(message: Message): MessageRow {
    return {
      id: message.id.toString(),
      conversation_id: message.conversationId.toString(),
      lead_id: message.leadId.toString(),
      direction: message.direction,
      message_type: message.messageType,
      body: message.body ?? null,
      wamid: message.wamid ?? null,
      template_name: message.templateName ?? null,
      delivery_status: message.deliveryStatus ?? null,
      sent_at: message.sentAt?.toISOString() ?? null,
      delivered_at: message.deliveredAt?.toISOString() ?? null,
      read_at: message.readAt?.toISOString() ?? null,
      created_at: message.createdAt.toISOString(),
      sender_type: message.senderType ?? null,
      sender_name: message.senderName ?? null,
    };
  }
}
