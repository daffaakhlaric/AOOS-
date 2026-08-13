import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** A closing rate, `0.0`-`1.0` inclusive. Never negative, never `NaN`. */
export class ClosingRate {
  private constructor(private readonly rate: number) {}

  static create(rate: number): Result<ClosingRate, ValidationError> {
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      return err(
        new ValidationError(
          `ClosingRate must be a finite number between 0.0 and 1.0, received: ${rate}`,
        ),
      );
    }
    return ok(new ClosingRate(rate));
  }

  /** `numerator / denominator`, divide-by-zero-safe: `denominator <= 0` resolves to `ClosingRate(0.0)`, never `NaN`. */
  static fromCounts(numerator: number, denominator: number): ClosingRate {
    if (denominator <= 0) {
      return new ClosingRate(0);
    }
    return new ClosingRate(numerator / denominator);
  }

  get value(): number {
    return this.rate;
  }
}
