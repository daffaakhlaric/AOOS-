import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

export const MIN_UNIT_YEAR = 2000;

/** A model year, bounded to `[2000, currentYear]` — DSS Motor does not stock anything older than 2000, and a future year is always invalid data. */
export class UnitYear {
  private constructor(private readonly value: number) {}

  static create(raw: number): Result<UnitYear, ValidationError> {
    const currentYear = new Date().getFullYear();
    if (typeof raw !== "number" || !Number.isInteger(raw)) {
      return err(
        new ValidationError(`UnitYear must be an integer, received: ${JSON.stringify(raw)}`),
      );
    }
    if (raw < MIN_UNIT_YEAR || raw > currentYear) {
      return err(
        new ValidationError(
          `UnitYear must be between ${MIN_UNIT_YEAR} and ${currentYear}, received: ${raw}`,
        ),
      );
    }
    return ok(new UnitYear(raw));
  }

  toNumber(): number {
    return this.value;
  }

  equals(other: UnitYear): boolean {
    return this.value === other.value;
  }
}
