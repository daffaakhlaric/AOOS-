import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** A 0-100 evergreen-health score — AAOS-W1D-S1S2 (S1). Higher means "safer to keep running long-term". */
export class EvergreenScore {
  private constructor(private readonly _value: number) {}

  static create(value: number): Result<EvergreenScore, ValidationError> {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return err(
        new ValidationError(
          `EvergreenScore must be a number between 0 and 100, received: ${String(value)}`,
        ),
      );
    }
    return ok(new EvergreenScore(value));
  }

  get value(): number {
    return this._value;
  }

  /** `>= 70` is the healthy threshold this package treats as "evergreen-eligible" (paired with the `daysActive > 60` check — see `HistoricalLearningService`). */
  isHealthy(): boolean {
    return this._value >= 70;
  }
}
