import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { Branch } from "@aos/meta-ads-connector";

import type { ConversationId } from "../value-objects/ConversationId.js";
import type { MessageId } from "../value-objects/MessageId.js";
import type { PhoneNumber } from "../value-objects/PhoneNumber.js";
import type { PhoneNumberId } from "../value-objects/PhoneNumberId.js";

export type ConversationStatus = "ACTIVE" | "CLOSED";

export interface ConversationProps {
  readonly id: ConversationId;
  readonly leadPhone: PhoneNumber;
  readonly wabaPhoneNumberId: PhoneNumberId;
  readonly branch: Branch;
  readonly messages: ReadonlyArray<MessageId>;
  readonly startedAt: Date;
  readonly lastMessageAt: Date;
  readonly messageCount: number;
  readonly status: ConversationStatus;
}

/**
 * An in-memory thread between Jessy and a lead, tracked for the process's lifetime only by
 * `ConversationService` — per the package's own scope, this is a bookkeeping convenience for
 * `isFirstMessage` detection, NOT persistent storage (that is `@aos/lead-store`'s future job).
 */
export class Conversation {
  private constructor(private readonly props: ConversationProps) {}

  static create(props: ConversationProps): Result<Conversation, ValidationError> {
    if (props.messageCount !== props.messages.length) {
      return err(
        new ValidationError(
          `Conversation.messageCount (${props.messageCount}) must equal messages.length (${props.messages.length})`,
        ),
      );
    }
    if (props.status !== "ACTIVE" && props.status !== "CLOSED") {
      return err(
        new ValidationError(
          `Conversation.status must be "ACTIVE" or "CLOSED", received: ${String(props.status)}`,
        ),
      );
    }
    return ok(new Conversation({ ...props, messages: [...props.messages] }));
  }

  get id(): ConversationId {
    return this.props.id;
  }

  get leadPhone(): PhoneNumber {
    return this.props.leadPhone;
  }

  get wabaPhoneNumberId(): PhoneNumberId {
    return this.props.wabaPhoneNumberId;
  }

  get branch(): Branch {
    return this.props.branch;
  }

  get messages(): ReadonlyArray<MessageId> {
    return this.props.messages;
  }

  get startedAt(): Date {
    return this.props.startedAt;
  }

  get lastMessageAt(): Date {
    return this.props.lastMessageAt;
  }

  get messageCount(): number {
    return this.props.messageCount;
  }

  get status(): ConversationStatus {
    return this.props.status;
  }

  /** Returns a NEW `Conversation` with `messageId` appended and `lastMessageAt` advanced — never mutates `this`. */
  withNewMessage(messageId: MessageId, at: Date): Conversation {
    const messages = [...this.props.messages, messageId];
    return new Conversation({
      ...this.props,
      messages,
      messageCount: messages.length,
      lastMessageAt: at,
    });
  }
}
