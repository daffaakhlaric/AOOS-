import type { OnTrackStatus } from "../domain/value-objects/OnTrackStatus.js";

/** Input to `IProgressCalculator.calculate` — the raw numeric facts a progress snapshot is derived from. */
export interface ProgressCalculationInput {
  readonly currentHotLeads: number;
  readonly currentSpend: number; // IDR
  readonly targetHotLeads: number;
  readonly budgetAllocation: number; // IDR
  readonly daysElapsed: number;
  readonly daysRemaining: number;
  readonly onTrackThreshold: number;
  readonly atRiskThreshold: number;
}

/** Output of `IProgressCalculator.calculate` — every derived metric `ObjectiveProgress` needs besides its identity/timestamp fields. */
export interface ProgressCalculationOutput {
  readonly progressPercentage: number;
  readonly dailyRunRate: number;
  readonly requiredDailyRunRate: number;
  readonly budgetBurnRate: number;
  readonly projectedBudgetAtEnd: number;
  readonly onTrackStatus: OnTrackStatus;
  readonly paceRatio: number;
}

/** Input to `IForecastStrategy.forecast` — the Strategy Pattern seam for forecast algorithms (spec: "Strategy Pattern (for forecast algorithms)"). */
export interface ForecastStrategyInput {
  readonly currentHotLeads: number;
  readonly targetHotLeads: number;
  readonly currentSpend: number;
  readonly budgetAllocation: number;
  readonly dailyRunRate: number;
  readonly budgetBurnRate: number;
  readonly daysElapsed: number;
  readonly daysRemaining: number;
  readonly requiredDailyRunRate: number;
  readonly onTrackStatus: OnTrackStatus;
  readonly now: Date;
}

/** Output of `IForecastStrategy.forecast` — matches the public `ForecastResult` shape minus identity fields the use case attaches. */
export interface ForecastStrategyOutput {
  readonly forecastedHotLeads: number;
  readonly forecastedSpend: number;
  readonly probability: number;
  readonly daysToTarget?: number;
  readonly budgetExhaustedAt?: Date;
}
