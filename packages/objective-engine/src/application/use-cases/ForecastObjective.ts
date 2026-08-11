import { err, ok, type Result } from "@aos/common";
import type { AdAccount } from "@aos/meta-ads-connector";
import type { getTracer } from "@aos/telemetry";
import { z } from "zod";

import type { ObjectiveEngineConfig } from "../../config/ObjectiveEngineConfig.js";
import type { IForecastStrategy } from "../../contracts/IForecastStrategy.js";
import type { IObjectiveRepository } from "../../contracts/IObjectiveRepository.js";
import type { IProgressCalculator } from "../../contracts/IProgressCalculator.js";
import {
  InvalidObjectiveError,
  ObjectiveNotFoundError,
  type ObjectiveError,
} from "../../domain/errors/index.js";
import type { ForecastResult } from "../../domain/value-objects/ForecastScore.js";
import type { ObjectiveId } from "../../domain/value-objects/ObjectiveId.js";
import { daysElapsedInPeriod, daysRemainingInPeriod } from "../../utils/PeriodUtils.js";

export type Tracer = ReturnType<typeof getTracer>;

const HotLeadsToDateSchema = z.number().int().nonnegative();

export interface ForecastObjectiveInput {
  readonly objectiveId: ObjectiveId;
  readonly adAccount: AdAccount;
  readonly hotLeadsToDate: number;
}

/**
 * Predicts an Objective's end-of-period result (spec: "ForecastObjective"). Note (judgment
 * call, documented in the package report): the spec's inline signature reads `Result<
 * ForecastResult, ForecastError>`, but this implementation's error channel is the broader
 * `ObjectiveError` — `ForecastError` alone cannot represent "no such Objective"
 * (`ObjectiveNotFoundError`) or "bad input" (`InvalidObjectiveError`), both of which are real,
 * expected failure paths here. `ForecastError` is still used for the one failure mode it
 * describes: the forecast computation itself.
 */
export class ForecastObjective {
  constructor(
    private readonly repository: IObjectiveRepository,
    private readonly progressCalculator: IProgressCalculator,
    private readonly forecastStrategy: IForecastStrategy,
    private readonly config: ObjectiveEngineConfig,
    private readonly tracer: Tracer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: ForecastObjectiveInput): Promise<Result<ForecastResult, ObjectiveError>> {
    return this.tracer.startActiveSpan(
      "objective-engine.forecast-objective",
      async (span: { end: () => void }) => {
        try {
          return this.run(input);
        } finally {
          span.end();
        }
      },
    );
  }

  private run(input: ForecastObjectiveInput): Result<ForecastResult, ObjectiveError> {
    const hotLeadsParsed = HotLeadsToDateSchema.safeParse(input.hotLeadsToDate);
    if (!hotLeadsParsed.success) {
      return err(
        new InvalidObjectiveError(
          `ForecastObjective.hotLeadsToDate must be a non-negative integer, received: ${String(input.hotLeadsToDate)}`,
        ),
      );
    }

    const found = this.repository.findById(input.objectiveId);
    if (!found.some) {
      return err(
        new ObjectiveNotFoundError(`No Objective found with id "${input.objectiveId.toString()}"`),
      );
    }
    const objective = found.value;
    const now = this.now();

    const daysElapsed = daysElapsedInPeriod(objective.period, now);
    const daysRemaining = daysRemainingInPeriod(objective.period, now);
    const currentSpend = input.adAccount.campaigns.reduce(
      (sum, campaign) => sum + campaign.spend.toNumber(),
      0,
    );

    const calculated = this.progressCalculator.calculate({
      currentHotLeads: hotLeadsParsed.data,
      currentSpend,
      targetHotLeads: objective.targetHotLeads.toNumber(),
      budgetAllocation: objective.budgetAllocation.toNumber(),
      daysElapsed,
      daysRemaining,
      onTrackThreshold: this.config.onTrackThreshold,
      atRiskThreshold: this.config.atRiskThreshold,
    });

    const forecast = this.forecastStrategy.forecast({
      currentHotLeads: hotLeadsParsed.data,
      targetHotLeads: objective.targetHotLeads.toNumber(),
      currentSpend,
      budgetAllocation: objective.budgetAllocation.toNumber(),
      dailyRunRate: calculated.dailyRunRate,
      budgetBurnRate: calculated.budgetBurnRate,
      daysElapsed,
      daysRemaining,
      requiredDailyRunRate: calculated.requiredDailyRunRate,
      onTrackStatus: calculated.onTrackStatus,
      now,
    });

    return ok({
      forecastedHotLeads: forecast.forecastedHotLeads,
      forecastedSpend: forecast.forecastedSpend,
      probability: forecast.probability,
      onTrackStatus: calculated.onTrackStatus,
      ...(forecast.daysToTarget !== undefined ? { daysToTarget: forecast.daysToTarget } : {}),
      ...(forecast.budgetExhaustedAt !== undefined
        ? { budgetExhaustedAt: forecast.budgetExhaustedAt }
        : {}),
    });
  }
}
