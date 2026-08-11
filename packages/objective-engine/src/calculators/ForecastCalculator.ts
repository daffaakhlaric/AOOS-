import type { IForecastStrategy } from "../contracts/IForecastStrategy.js";
import { OnTrackStatus } from "../domain/value-objects/OnTrackStatus.js";
import type { ForecastStrategyInput, ForecastStrategyOutput } from "../types/ObjectiveTypes.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The v1 linear forecast strategy (spec: "Forecast Algorithm — Simple linear projection (v1)").
 * See README "Extension points" / package report "Forecast model limitations" for how a future
 * non-linear `IForecastStrategy` implementation would plug in without touching `ForecastObjective`.
 *
 * Rounding (package report "forecast rounding" resolution): `forecastedHotLeads` is always
 * `Math.floor`'d, never rounded up/nearest — matching the pinned business-correctness test
 * (`forecast: given 12 hot leads in 8 days, 23 days remaining → forecast=46`, i.e.
 * `Math.floor(12 + (12/8)*23) === Math.floor(46.5) === 46`).
 *
 * Division-by-zero safety: when `budgetBurnRate === 0`, the budget can never be exhausted by
 * spend, so `daysCanSustain` is treated as unbounded (`Number.POSITIVE_INFINITY`) rather than
 * computed via `budgetRemaining / 0` — never `NaN`/`Infinity` leaks into the returned
 * `ForecastResult` itself (the linear branch always wins in that case).
 */
export class ForecastCalculator implements IForecastStrategy {
  forecast(input: ForecastStrategyInput): ForecastStrategyOutput {
    const linearTotal = input.currentHotLeads + input.dailyRunRate * input.daysRemaining;

    const budgetRemaining = Math.max(0, input.budgetAllocation - input.currentSpend);
    const daysCanSustain =
      input.budgetBurnRate === 0
        ? Number.POSITIVE_INFINITY
        : budgetRemaining / input.budgetBurnRate;

    const budgetConstrained = daysCanSustain < input.daysRemaining;
    const effectiveDays = budgetConstrained ? Math.max(0, daysCanSustain) : input.daysRemaining;

    const forecastedTotalRaw = budgetConstrained
      ? input.currentHotLeads + input.dailyRunRate * effectiveDays
      : linearTotal;

    const forecastedHotLeads = Math.max(0, Math.floor(forecastedTotalRaw));

    const forecastedSpendRaw = budgetConstrained
      ? input.budgetAllocation
      : input.currentSpend + input.budgetBurnRate * input.daysRemaining;
    const forecastedSpend = Math.max(0, Math.round(forecastedSpendRaw));

    const willMeetTarget = forecastedHotLeads >= input.targetHotLeads;
    const probability = this.estimateProbability(input.onTrackStatus, willMeetTarget);

    const remainingHotLeads = Math.max(0, input.targetHotLeads - input.currentHotLeads);
    const daysToTarget = this.estimateDaysToTarget(
      input.onTrackStatus,
      remainingHotLeads,
      input.dailyRunRate,
    );

    const budgetExhaustedAt = budgetConstrained
      ? new Date(input.now.getTime() + Math.max(0, daysCanSustain) * MS_PER_DAY)
      : undefined;

    return {
      forecastedHotLeads,
      forecastedSpend,
      probability,
      ...(daysToTarget !== undefined ? { daysToTarget } : {}),
      ...(budgetExhaustedAt !== undefined ? { budgetExhaustedAt } : {}),
    };
  }

  /** A deterministic v1 heuristic — see package report "Forecast model limitations" for why this is not a statistical probability. */
  private estimateProbability(onTrackStatus: OnTrackStatus, willMeetTarget: boolean): number {
    if (onTrackStatus === OnTrackStatus.ON_TRACK) {
      return willMeetTarget ? 90 : 65;
    }
    if (onTrackStatus === OnTrackStatus.AT_RISK) {
      return willMeetTarget ? 60 : 40;
    }
    return willMeetTarget ? 30 : 10;
  }

  /** Only meaningful (and only returned) when `ON_TRACK` and the target is not yet met and there is an actual pace to project from. */
  private estimateDaysToTarget(
    onTrackStatus: OnTrackStatus,
    remainingHotLeads: number,
    dailyRunRate: number,
  ): number | undefined {
    if (onTrackStatus !== OnTrackStatus.ON_TRACK) {
      return undefined;
    }
    if (remainingHotLeads <= 0) {
      return 0;
    }
    if (dailyRunRate <= 0) {
      return undefined;
    }
    return Math.ceil(remainingHotLeads / dailyRunRate);
  }
}
