import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** The AAOS-internal identifier for a `Closing` record. Mirrors `LeadId`. */
export class ClosingId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<ClosingId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(
          `ClosingId must be a non-empty string, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new ClosingId(raw));
  }

  static generate(): ClosingId {
    return new ClosingId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: ClosingId): boolean {
    return this.value === other.value;
  }
}
