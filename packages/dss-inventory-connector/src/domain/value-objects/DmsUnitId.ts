import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * The external unit id assigned by DSS Motor's Dealer Management System — present only on units
 * whose source is (or has been reconciled with) `SourceSystem.DMS`. Kept as its own value object
 * (not just `string`) so it can never be confused with the AAOS-internal `UnitId`.
 */
export class DmsUnitId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<DmsUnitId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(
          `DmsUnitId must be a non-empty string, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new DmsUnitId(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: DmsUnitId): boolean {
    return this.value === other.value;
  }
}
