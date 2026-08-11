import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** The AAOS-internal identifier for a `Conversation` record. Mirrors `LeadId`. */
export class ConversationId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<ConversationId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(
          `ConversationId must be a non-empty string, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new ConversationId(raw));
  }

  static generate(): ConversationId {
    return new ConversationId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: ConversationId): boolean {
    return this.value === other.value;
  }
}
