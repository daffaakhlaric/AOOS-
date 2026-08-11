import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** Meta's `phone_number_id` — the WABA-scoped id identifying which branch's WhatsApp number sent/received a message. */
export class PhoneNumberId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<PhoneNumberId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(
          `PhoneNumberId must be a non-empty string, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new PhoneNumberId(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: PhoneNumberId): boolean {
    return this.value === other.value;
  }
}
