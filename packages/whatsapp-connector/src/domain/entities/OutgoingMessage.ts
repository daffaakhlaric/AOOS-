import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { Branch } from "@aos/meta-ads-connector";

import type { ConversationId } from "../value-objects/ConversationId.js";
import type { MessageBody } from "../value-objects/MessageBody.js";
import type { MessageId } from "../value-objects/MessageId.js";
import { MessageStatus } from "../value-objects/MessageStatus.js";
import { MessageType } from "../value-objects/MessageType.js";
import type { PhoneNumber } from "../value-objects/PhoneNumber.js";
import type { PhoneNumberId } from "../value-objects/PhoneNumberId.js";

export interface OutgoingMessageProps {
  readonly id: MessageId;
  readonly to: PhoneNumber;
  readonly from: PhoneNumberId;
  readonly branch: Branch;
  readonly conversationId: ConversationId;
  readonly type: MessageType;
  readonly body: MessageBody;
  readonly status: MessageStatus;
  readonly sentAt?: Date;
  readonly deliveredAt?: Date;
  readonly readAt?: Date;
}

/**
 * A message sent by Clara to a lead. Immutable, and — per the engineering report's resolution #4
 * — never mutated in place across its send lifecycle. `SendTextMessage`/`SendTemplateMessage`/
 * `SendInteractiveMessage` construct a PRELIMINARY `OutgoingMessage` with a locally-generated
 * placeholder `MessageId` (`MessageId.generate()`) and `status: SENT` pending confirmation before
 * calling the WhatsApp Cloud API, then — once the send succeeds — construct a NEW, separate
 * `OutgoingMessage` instance carrying the confirmed Meta-returned `wamid` (via `MessageId.create`)
 * and a fresh `sentAt`. The preliminary instance is discarded, not mutated.
 */
export class OutgoingMessage {
  private constructor(private readonly props: OutgoingMessageProps) {}

  static create(props: OutgoingMessageProps): Result<OutgoingMessage, ValidationError> {
    if (!Object.values(MessageType).includes(props.type)) {
      return err(
        new ValidationError(
          `OutgoingMessage.type must be a valid MessageType, received: ${String(props.type)}`,
        ),
      );
    }
    if (!Object.values(MessageStatus).includes(props.status)) {
      return err(
        new ValidationError(
          `OutgoingMessage.status must be a valid MessageStatus, received: ${String(props.status)}`,
        ),
      );
    }
    return ok(new OutgoingMessage({ ...props }));
  }

  get id(): MessageId {
    return this.props.id;
  }

  get to(): PhoneNumber {
    return this.props.to;
  }

  get from(): PhoneNumberId {
    return this.props.from;
  }

  get branch(): Branch {
    return this.props.branch;
  }

  get conversationId(): ConversationId {
    return this.props.conversationId;
  }

  get type(): MessageType {
    return this.props.type;
  }

  get body(): MessageBody {
    return this.props.body;
  }

  get status(): MessageStatus {
    return this.props.status;
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

  /** Returns a NEW `OutgoingMessage` with the confirmed Meta `wamid` and `status: SENT` — never mutates `this`. See the class doc for why this exists instead of a setter. */
  withConfirmedSend(id: MessageId, sentAt: Date): OutgoingMessage {
    return new OutgoingMessage({ ...this.props, id, status: MessageStatus.SENT, sentAt });
  }

  /** Returns a NEW `OutgoingMessage` reflecting a later status transition (DELIVERED/READ/FAILED). */
  withStatus(status: MessageStatus, at: Date): OutgoingMessage {
    if (status === MessageStatus.DELIVERED) {
      return new OutgoingMessage({ ...this.props, status, deliveredAt: at });
    }
    if (status === MessageStatus.READ) {
      return new OutgoingMessage({ ...this.props, status, readAt: at });
    }
    return new OutgoingMessage({ ...this.props, status });
  }
}
