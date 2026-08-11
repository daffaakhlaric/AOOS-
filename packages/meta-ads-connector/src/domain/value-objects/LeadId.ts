import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Internal AAOS-generated UUID identifying a Lead parsed from a webhook payload. */
export class LeadId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<LeadId, ValidationError> {
    if (typeof raw !== "string" || !UUID_PATTERN.test(raw)) {
      return err(new ValidationError(`LeadId must be a UUID, received: ${JSON.stringify(raw)}`));
    }
    return ok(new LeadId(raw));
  }

  static generate(): LeadId {
    return new LeadId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: LeadId): boolean {
    return this.value === other.value;
  }
}
