import type { Result } from "@aos/common";
import type { AdAccount } from "@aos/meta-ads-connector";

import {
  calculateAverageRphD3,
  calculateBudgetPlanning,
  calculateD3Needed,
} from "../../calculators/BackwardPlanningCalculator.js";
import type { ObjectiveEngineConfig } from "../../config/ObjectiveEngineConfig.js";
import type { Objective } from "../../domain/entities/Objective.js";
import type { ObjectiveError } from "../../domain/errors/index.js";
import type { ForecastResult } from "../../domain/value-objects/ForecastScore.js";
import type { ForecastObjective, ForecastObjectiveInput } from "../use-cases/ForecastObjective.js";

export interface BudgetPlan {
  readonly d3Needed: number;
  readonly avgRphD3: number;
  readonly budgetNeeded: number;
  readonly recommendedBudget: number;
  readonly isBudgetSufficient: boolean;
}

/**
 * A facade over `ForecastObjective`, plus the call site for the Backward Planning Algorithm's
 * `AdAccount`-dependent half (package report "backward-planning placement" decision — part (b):
 * `avg_rph_d3` → `budget_needed` → `recommended_budget`). `getBudgetPlan` is deliberately a
 * separate method from `forecast()` rather than folded into `ForecastResult`'s shape, since
 * `ForecastResult` is spec-pinned (`forecastedHotLeads`/`forecastedSpend`/`probability`/
 * `onTrackStatus`/`daysToTarget?`/`budgetExhaustedAt?` only) and budget-planning figures are a
 * distinct concern a caller opts into separately.
 */
export class ForecastService {
  constructor(
    private readonly forecastObjectiveUseCase: ForecastObjective,
    private readonly config: ObjectiveEngineConfig,
  ) {}

  forecast(input: ForecastObjectiveInput): Promise<Result<ForecastResult, ObjectiveError>> {
    return this.forecastObjectiveUseCase.execute(input);
  }

  /** Backward Planning part (b) — needs a real `AdAccount` to derive `avg_rph_d3`, unlike `d3Needed` alone (see `GetObjectiveStatus`). */
  getBudgetPlan(objective: Objective, adAccount: AdAccount): BudgetPlan {
    const d3Needed = calculateD3Needed(
      objective.targetHotLeads.toNumber(),
      this.config.hotLeadConversionRate,
    );
    const avgRphD3 = calculateAverageRphD3(adAccount);
    const { budgetNeeded, recommendedBudget } = calculateBudgetPlanning(
      d3Needed,
      avgRphD3,
      this.config.budgetBufferFactor,
    );
    return {
      d3Needed,
      avgRphD3,
      budgetNeeded,
      recommendedBudget,
      isBudgetSufficient: objective.budgetAllocation.toNumber() >= recommendedBudget,
    };
  }
}
