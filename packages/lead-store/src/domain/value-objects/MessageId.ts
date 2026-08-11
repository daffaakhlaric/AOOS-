import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** The AAOS-internal identifier for a `Message` record. Mirrors `LeadId`. */
export class MessageId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<MessageId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(
          `MessageId must be a non-empty string, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new MessageId(raw));
  }

  static generate(): MessageId {
    return new MessageId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: MessageId): boolean {
    return this.value === other.value;
  }
}
