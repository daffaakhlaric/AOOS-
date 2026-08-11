import type { ForecastStrategyInput, ForecastStrategyOutput } from "../types/ObjectiveTypes.js";

/**
 * Strategy Pattern port for forecast algorithms (spec Architecture: "Strategy Pattern (for
 * forecast algorithms)"). `calculators/ForecastCalculator.ts` is the v1 (linear) implementation;
 * a future non-linear model (e.g. seasonality-aware) can implement this same port without
 * touching `ForecastObjective`/`ForecastService` — see README "Extension points".
 */
export interface IForecastStrategy {
  forecast(input: ForecastStrategyInput): ForecastStrategyOutput;
}
