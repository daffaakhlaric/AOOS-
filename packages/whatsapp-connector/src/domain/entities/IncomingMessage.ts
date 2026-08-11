import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { Branch } from "@aos/meta-ads-connector";

import type { ConversationId } from "../value-objects/ConversationId.js";
import type { MessageBody } from "../value-objects/MessageBody.js";
import type { MessageId } from "../value-objects/MessageId.js";
import { MessageType } from "../value-objects/MessageType.js";
import type { PhoneNumber } from "../value-objects/PhoneNumber.js";
import type { PhoneNumberId } from "../value-objects/PhoneNumberId.js";

export interface IncomingMessageProps {
  readonly id: MessageId;
  readonly from: PhoneNumber;
  readonly to: PhoneNumberId;
  readonly branch: Branch;
  readonly conversationId: ConversationId;
  readonly type: MessageType;
  readonly body?: MessageBody;
  readonly timestamp: Date;
  readonly isFirstMessage: boolean;
}

/** A message received from a lead, parsed by `WebhookParser` from a Meta webhook payload. */
export class IncomingMessage {
  private constructor(private readonly props: IncomingMessageProps) {}

  static create(props: IncomingMessageProps): Result<IncomingMessage, ValidationError> {
    if (!Object.values(MessageType).includes(props.type)) {
      return err(
        new ValidationError(
          `IncomingMessage.type must be a valid MessageType, received: ${String(props.type)}`,
        ),
      );
    }
    if (props.type === MessageType.TEXT && props.body === undefined) {
      return err(new ValidationError("IncomingMessage.body is required when type is TEXT"));
    }
    return ok(new IncomingMessage({ ...props }));
  }

  get id(): MessageId {
    return this.props.id;
  }

  get from(): PhoneNumber {
    return this.props.from;
  }

  get to(): PhoneNumberId {
    return this.props.to;
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

  get body(): MessageBody | undefined {
    return this.props.body;
  }

  get timestamp(): Date {
    return this.props.timestamp;
  }

  get isFirstMessage(): boolean {
    return this.props.isFirstMessage;
  }
}
