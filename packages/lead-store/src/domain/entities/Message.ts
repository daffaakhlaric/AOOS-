import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { ConversationId } from "../value-objects/ConversationId.js";
import type { LeadId } from "../value-objects/LeadId.js";
import type { MessageId } from "../value-objects/MessageId.js";

export type MessageDirection = "INCOMING" | "OUTGOING";
export type MessageContentType = "TEXT" | "TEMPLATE" | "INTERACTIVE" | "IMAGE";
export type MessageDeliveryStatus = "SENT" | "DELIVERED" | "READ" | "FAILED";
/**
 * AAOS-CHAT-ROOM-JESSY (coordinator note #2) — who actually authored an OUTGOING message.
 * `undefined`/`null` for every INCOMING message (the lead is always the sender there — no column
 * needed) and for OUTGOING rows persisted before this migration (backfilled to `"JESSY"` by
 * `004_message_sender.sql`, but a defensive `undefined` is still valid here for any row that
 * predates that backfill in a not-yet-migrated environment).
 */
export type MessageSenderType = "JESSY" | "SALES_HUMAN" | "MANAGER_INTERVENTION";

export interface MessageProps {
  readonly id: MessageId;
  readonly conversationId: ConversationId;
  readonly leadId: LeadId;
  readonly direction: MessageDirection;
  readonly messageType: MessageContentType;
  readonly body?: string;
  readonly wamid?: string;
  readonly templateName?: string;
  readonly deliveryStatus?: MessageDeliveryStatus;
  readonly sentAt?: Date;
  readonly deliveredAt?: Date;
  readonly readAt?: Date;
  readonly createdAt: Date;
  readonly senderType?: MessageSenderType;
  /** Human display name — populated for `SALES_HUMAN`/`MANAGER_INTERVENTION`, `undefined` for `JESSY`. */
  readonly senderName?: string;
}

/** One persisted inbound or outbound WhatsApp message (spec table `messages`). */
export class Message {
  private constructor(private readonly props: MessageProps) {}

  static create(props: MessageProps): Result<Message, ValidationError> {
    if (props.direction !== "INCOMING" && props.direction !== "OUTGOING") {
      return err(
        new ValidationError(
          `Message.direction must be INCOMING or OUTGOING, received: ${String(props.direction)}`,
        ),
      );
    }
    return ok(new Message({ ...props }));
  }

  get id(): MessageId {
    return this.props.id;
  }

  get conversationId(): ConversationId {
    return this.props.conversationId;
  }

  get leadId(): LeadId {
    return this.props.leadId;
  }

  get direction(): MessageDirection {
    return this.props.direction;
  }

  get messageType(): MessageContentType {
    return this.props.messageType;
  }

  get body(): string | undefined {
    return this.props.body;
  }

  get wamid(): string | undefined {
    return this.props.wamid;
  }

  get templateName(): string | undefined {
    return this.props.templateName;
  }

  get deliveryStatus(): MessageDeliveryStatus | undefined {
    return this.props.deliveryStatus;
  }

  get sentAt(): Date | undefined {
    return this.props.sentAt;
  }

  get deliveredAt(): Date | undefined {
    return this.props.deliveredAt;
  }

  get readAt(): Date | undefined {
    return this.props.readAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get senderType(): MessageSenderType | undefined {
    return this.props.senderType;
  }

  get senderName(): string | undefined {
    return this.props.senderName;
  }
}
