import { err, ok, type Result } from "@aos/common";

import { InvalidMessageBodyError } from "../errors/InvalidMessageBodyError.js";

/** WhatsApp Cloud API's hard limit on a text message body. */
export const MAX_MESSAGE_BODY_LENGTH = 4096;

/** Free-text message content — 1 to 4096 characters, per WhatsApp Cloud API's text message limit. */
export class MessageBody {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<MessageBody, InvalidMessageBodyError> {
    if (typeof raw !== "string" || raw.length === 0) {
      return err(new InvalidMessageBodyError("MessageBody must be a non-empty string"));
    }
    if (raw.length > MAX_MESSAGE_BODY_LENGTH) {
      return err(
        new InvalidMessageBodyError(
          `MessageBody must not exceed ${MAX_MESSAGE_BODY_LENGTH} characters, received ${raw.length}`,
        ),
      );
    }
    return ok(new MessageBody(raw));
  }

  toString(): string {
    return this.value;
  }

  get length(): number {
    return this.value.length;
  }

  equals(other: MessageBody): boolean {
    return this.value === other.value;
  }
}
