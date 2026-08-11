import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** The AAOS-internal identifier for a `LeadAssignment` record — a UUID this package generates itself. Mirrors `SalesHumanId`/`UnitId`. */
export class AssignmentId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<AssignmentId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(
          `AssignmentId must be a non-empty string, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new AssignmentId(raw));
  }

  static generate(): AssignmentId {
    return new AssignmentId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: AssignmentId): boolean {
    return this.value === other.value;
  }
}
