import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** The AAOS-internal identifier for a `SalesHuman` — a UUID this package generates itself. Mirrors `@aos/dss-inventory-connector`'s `UnitId` pattern. */
export class SalesHumanId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<SalesHumanId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(
          `SalesHumanId must be a non-empty string, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new SalesHumanId(raw));
  }

  static generate(): SalesHumanId {
    return new SalesHumanId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: SalesHumanId): boolean {
    return this.value === other.value;
  }
}
