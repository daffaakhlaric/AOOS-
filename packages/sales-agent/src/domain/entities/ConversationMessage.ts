import { err, ok, type Result } from "@aos/common";

import { ConversationError } from "../errors/ConversationError.js";

/** Direction of a single message inside a `LeadConversation`. */
export enum MessageDirection {
  INBOUND = "INBOUND",
  OUTBOUND = "OUTBOUND",
}

export interface ConversationMessageProps {
  readonly text: string;
  readonly direction: MessageDirection;
  readonly occurredAt: Date;
}

/** One message (inbound from the lead, or outbound from Jessy) inside a `LeadConversation`. Immutable. */
export class ConversationMessage {
  private constructor(private readonly props: ConversationMessageProps) {}

  static create(props: ConversationMessageProps): Result<ConversationMessage, ConversationError> {
    if (typeof props.text !== "string" || props.text.trim().length === 0) {
      return err(new ConversationError("ConversationMessage.text must be a non-empty string"));
    }
    if (!Object.values(MessageDirection).includes(props.direction)) {
      return err(
        new ConversationError(
          `ConversationMessage.direction must be a valid MessageDirection, received: ${String(props.direction)}`,
        ),
      );
    }
    return ok(new ConversationMessage({ ...props }));
  }

  get text(): string {
    return this.props.text;
  }

  get direction(): MessageDirection {
    return this.props.direction;
  }

  get occurredAt(): Date {
    return this.props.occurredAt;
  }

  get isInbound(): boolean {
    return this.props.direction === MessageDirection.INBOUND;
  }
}
