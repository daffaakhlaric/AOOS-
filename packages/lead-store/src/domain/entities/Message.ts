import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { ConversationId } from "../value-objects/ConversationId.js";
import type { LeadId } from "../value-objects/LeadId.js";
import type { MessageId } from "../value-objects/MessageId.js";

export type MessageDirection = "INCOMING" | "OUTGOING";
export type MessageContentType = "TEXT" | "TEMPLATE" | "INTERACTIVE" | "IMAGE";
export type MessageDeliveryStatus = "SENT" | "DELIVERED" | "READ" | "FAILED";

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
}
