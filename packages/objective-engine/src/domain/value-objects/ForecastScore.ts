import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { OnTrackStatus } from "./OnTrackStatus.js";

/**
 * The projected final hot-leads count for an Objective's period, computed by
 * `ForecastCalculator` (spec: "Forecast Algorithm" — simple linear projection in v1, see
 * README "Extension points" for how a future non-linear `IForecastStrategy` would plug in).
 * Always a non-negative integer — `Math.floor`'d at the calculator boundary (see
 * `ForecastCalculator` and the package report's "forecast rounding" decision), never
 * fractional, never negative.
 */
export class ForecastScore {
  private constructor(private readonly value: number) {}

  static create(value: number): Result<ForecastScore, ValidationError> {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return err(
        new ValidationError(`ForecastScore must be a finite number, received: ${String(value)}`),
      );
    }
    if (!Number.isInteger(value)) {
      return err(new ValidationError(`ForecastScore must be an integer, received: ${value}`));
    }
    if (value < 0) {
      return err(new ValidationError(`ForecastScore must not be negative, received: ${value}`));
    }
    return ok(new ForecastScore(value));
  }

  toNumber(): number {
    return this.value;
  }

  equals(other: ForecastScore): boolean {
    return this.value === other.value;
  }
}

/**
 * The Output shape of `ForecastObjective`'s use case (spec: "ForecastResult"). Co-located with
 * `ForecastScore` in this file, not a separate file — the spec's own `index.ts` example imports
 * `ForecastResult` `from "./domain/value-objects/ForecastScore.js"`, so this placement is
 * literal, not a judgment call.
 */
export interface ForecastResult {
  readonly forecastedHotLeads: number;
  readonly forecastedSpend: number;
  readonly probability: number; // 0-100
  readonly onTrackStatus: OnTrackStatus;
  /** If on track, the number of days from "now" until the target is projected to be hit. Absent when the target will not be hit within the period at the current pace. */
  readonly daysToTarget?: number;
  /** If the budget is projected to run out before the period ends, the date it is exhausted. Absent when the budget is projected to last the full period. */
  readonly budgetExhaustedAt?: Date;
}
