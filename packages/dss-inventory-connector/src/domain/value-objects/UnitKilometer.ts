import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

export const MAX_UNIT_KILOMETER = 999_999;

/** An odometer reading in kilometers, bounded to `[0, 999_999]`. */
export class UnitKilometer {
  private constructor(private readonly value: number) {}

  static create(raw: number): Result<UnitKilometer, ValidationError> {
    if (typeof raw !== "number" || !Number.isInteger(raw)) {
      return err(
        new ValidationError(`UnitKilometer must be an integer, received: ${JSON.stringify(raw)}`),
      );
    }
    if (raw < 0 || raw > MAX_UNIT_KILOMETER) {
      return err(
        new ValidationError(
          `UnitKilometer must be between 0 and ${MAX_UNIT_KILOMETER}, received: ${raw}`,
        ),
      );
    }
    return ok(new UnitKilometer(raw));
  }

  toNumber(): number {
    return this.value;
  }

  equals(other: UnitKilometer): boolean {
    return this.value === other.value;
  }
}
