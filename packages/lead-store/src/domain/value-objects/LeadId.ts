import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** The AAOS-internal identifier for a `Lead` record — a UUID this package generates itself (or accepts back from a Supabase row's `id` column). Mirrors `@aos/branch-manager`'s `AssignmentId` pattern. */
export class LeadId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<LeadId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(`LeadId must be a non-empty string, received: ${JSON.stringify(raw)}`),
      );
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
