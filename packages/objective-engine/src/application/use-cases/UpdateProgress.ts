import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";
import type { AdAccount } from "@aos/meta-ads-connector";
import type { getTracer } from "@aos/telemetry";
import { z } from "zod";

import type { ObjectiveEngineConfig } from "../../config/ObjectiveEngineConfig.js";
import type { IForecastStrategy } from "../../contracts/IForecastStrategy.js";
import type { IObjectiveRepository } from "../../contracts/IObjectiveRepository.js";
import type { IProgressCalculator } from "../../contracts/IProgressCalculator.js";
import { ObjectiveProgress } from "../../domain/entities/ObjectiveProgress.js";
import {
  InvalidObjectiveError,
  ObjectiveNotFoundError,
  type ObjectiveError,
} from "../../domain/errors/index.js";
import type { ObjectiveEngineEvents } from "../../domain/events/ObjectiveEngineEvents.js";
import { BudgetAllocation } from "../../domain/value-objects/BudgetAllocation.js";
import { ForecastScore } from "../../domain/value-objects/ForecastScore.js";
import type { ObjectiveId } from "../../domain/value-objects/ObjectiveId.js";
import { ObjectiveStatus } from "../../domain/value-objects/ObjectiveStatus.js";
import { OnTrackStatus } from "../../domain/value-objects/OnTrackStatus.js";
import { ProgressPercentage } from "../../domain/value-objects/ProgressPercentage.js";
import { daysElapsedInPeriod, daysRemainingInPeriod } from "../../utils/PeriodUtils.js";

export type Tracer = ReturnType<typeof getTracer>;

const HotLeadsCountSchema = z.number().int().nonnegative();

export interface UpdateProgressInput {
  readonly objectiveId: ObjectiveId;
  readonly adAccount: AdAccount;
  readonly hotLeadsCount: number;
  readonly correlationId: string;
}

/**
 * Recomputes and stores an `ObjectiveProgress` snapshot for an Objective, called daily with
 * fresh `AdAccount` data (spec: "UpdateProgress"). Also detects the "100% target hit early"
 * edge case (transitioning the Objective to `COMPLETED` + emitting `ObjectiveCompleted`) and the
 * `ratio < atRiskThreshold` off-track edge case (emitting `ObjectiveOffTrack`).
 */
export class UpdateProgress {
  constructor(
    private readonly repository: IObjectiveRepository,
    private readonly calculator: IProgressCalculator,
    private readonly forecastStrategy: IForecastStrategy,
    private readonly events: ObjectiveEngineEvents,
    private readonly config: ObjectiveEngineConfig,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: UpdateProgressInput): Promise<Result<ObjectiveProgress, ObjectiveError>> {
    return this.tracer.startActiveSpan(
      "objective-engine.update-progress",
      async (span: { end: () => void }) => {
        try {
          return await this.run(input);
        } finally {
          span.end();
        }
      },
    );
  }

  private async run(
    input: UpdateProgressInput,
  ): Promise<Result<ObjectiveProgress, ObjectiveError>> {
    const hotLeadsParsed = HotLeadsCountSchema.safeParse(input.hotLeadsCount);
    if (!hotLeadsParsed.success) {
      return err(
        new InvalidObjectiveError(
          `UpdateProgress.hotLeadsCount must be a non-negative integer, received: ${String(input.hotLeadsCount)}`,
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
    const currentSpend = this.totalSpend(input.adAccount);

    const calculated = this.calculator.calculate({
      currentHotLeads: hotLeadsParsed.data,
      currentSpend,
      targetHotLeads: objective.targetHotLeads.toNumber(),
      budgetAllocation: objective.budgetAllocation.toNumber(),
      daysElapsed,
      daysRemaining,
      onTrackThreshold: this.config.onTrackThreshold,
      atRiskThreshold: this.config.atRiskThreshold,
    });

    // Reuses the same `IForecastStrategy` (linear v1) `ForecastObjective` uses, rather than a
    // second hand-rolled projection — a single source of truth for "what does the linear/
    // budget-constrained forecast say", including the budget-constrained branch.
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
    const forecastedRaw = forecast.forecastedHotLeads;

    const currentSpendVo = BudgetAllocation.create(Math.round(currentSpend));
    /* v8 ignore next 3 */
    if (!currentSpendVo.ok) {
      return err(new InvalidObjectiveError(currentSpendVo.error.message));
    }
    const projectedBudgetVo = BudgetAllocation.create(Math.round(calculated.projectedBudgetAtEnd));
    /* v8 ignore next 3 */
    if (!projectedBudgetVo.ok) {
      return err(new InvalidObjectiveError(projectedBudgetVo.error.message));
    }
    const forecastVo = ForecastScore.create(forecastedRaw);
    /* v8 ignore next 3 */
    if (!forecastVo.ok) {
      return err(new InvalidObjectiveError(forecastVo.error.message));
    }
    const progressPercentageVo = clampedPercentage(calculated.progressPercentage);

    const progressResult = ObjectiveProgress.create({
      objectiveId: input.objectiveId,
      currentHotLeads: hotLeadsParsed.data,
      currentSpend: currentSpendVo.value,
      daysElapsed,
      daysRemaining,
      progressPercentage: progressPercentageVo,
      dailyRunRate: calculated.dailyRunRate,
      requiredDailyRunRate: calculated.requiredDailyRunRate,
      forecastedHotLeads: forecastVo.value,
      budgetBurnRate: calculated.budgetBurnRate,
      projectedBudgetAtEnd: projectedBudgetVo.value,
      onTrackStatus: calculated.onTrackStatus,
      updatedAt: now,
    });
    /* v8 ignore next 3 */
    if (!progressResult.ok) {
      return err(new InvalidObjectiveError(progressResult.error.message));
    }

    this.repository.saveProgress(progressResult.value);

    await this.events.publishProgressUpdated({
      objectiveId: input.objectiveId.toString(),
      tenantId: objective.tenantId,
      currentHotLeads: hotLeadsParsed.data,
      progressPercentage: progressPercentageVo.toNumber(),
      onTrackStatus: calculated.onTrackStatus,
      correlationId: input.correlationId,
      occurredAt: now,
      version: "1.0",
    });

    if (calculated.onTrackStatus === OnTrackStatus.OFF_TRACK) {
      await this.events.publishObjectiveOffTrack({
        objectiveId: input.objectiveId.toString(),
        tenantId: objective.tenantId,
        ratio: calculated.paceRatio,
        currentHotLeads: hotLeadsParsed.data,
        targetHotLeads: objective.targetHotLeads.toNumber(),
        daysRemaining,
        correlationId: input.correlationId,
        occurredAt: now,
        version: "1.0",
      });
    }

    if (
      hotLeadsParsed.data >= objective.targetHotLeads.toNumber() &&
      objective.status !== ObjectiveStatus.COMPLETED
    ) {
      const completed = objective.complete(now);
      this.repository.save(completed);
      await this.events.publishObjectiveCompleted({
        objectiveId: input.objectiveId.toString(),
        tenantId: objective.tenantId,
        finalHotLeads: hotLeadsParsed.data,
        targetHotLeads: objective.targetHotLeads.toNumber(),
        correlationId: input.correlationId,
        occurredAt: now,
        version: "1.0",
      });
    }

    this.logger.info(
      {
        objectiveId: input.objectiveId.toString(),
        onTrackStatus: calculated.onTrackStatus,
        progressPercentage: progressPercentageVo.toNumber(),
      },
      "objective-engine: progress updated",
    );

    return ok(progressResult.value);
  }

  private totalSpend(adAccount: AdAccount): number {
    return adAccount.campaigns.reduce((sum, campaign) => sum + campaign.spend.toNumber(), 0);
  }
}

/** `ProgressCalculator` already clamps its output to [0, 100], so this construction is infallible in practice. */
function clampedPercentage(value: number): ProgressPercentage {
  const result = ProgressPercentage.create(value);
  /* v8 ignore next 3 */
  if (!result.ok) {
    throw new Error(`Unreachable: ProgressCalculator output out of range: ${result.error.message}`);
  }
  return result.value;
}
