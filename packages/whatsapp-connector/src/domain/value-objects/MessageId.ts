import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * A WhatsApp message id — either Meta's own `wamid.xxx` (a confirmed, sent/received message) or a
 * locally-generated placeholder UUID (`MessageId.generate()`), used by `SendTextMessage` et al.
 * to construct a preliminary `OutgoingMessage` before the real Meta `wamid` is known. See the
 * engineering report's resolution #4 (`OutgoingMessage` two-instance-construction pattern).
 */
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

  /** A locally-generated placeholder id, used before the real Meta `wamid` is known. */
  static generate(): MessageId {
    return new MessageId(`local.${crypto.randomUUID()}`);
  }

  toString(): string {
    return this.value;
  }

  equals(other: MessageId): boolean {
    return this.value === other.value;
  }
}
