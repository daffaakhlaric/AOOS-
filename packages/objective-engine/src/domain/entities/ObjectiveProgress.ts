import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { BudgetAllocation } from "../value-objects/BudgetAllocation.js";
import type { ForecastScore } from "../value-objects/ForecastScore.js";
import type { ObjectiveId } from "../value-objects/ObjectiveId.js";
import { OnTrackStatus } from "../value-objects/OnTrackStatus.js";
import type { ProgressPercentage } from "../value-objects/ProgressPercentage.js";

export interface ObjectiveProgressProps {
  readonly objectiveId: ObjectiveId;
  readonly currentHotLeads: number;
  readonly currentSpend: BudgetAllocation;
  readonly daysElapsed: number;
  readonly daysRemaining: number;
  readonly progressPercentage: ProgressPercentage;
  /** Hot leads/day, actual pace so far. `0` when `daysElapsed === 0` (see package report — no data yet to compute a rate). */
  readonly dailyRunRate: number;
  /** Hot leads/day required for the remainder of the period to hit target. `0` when `daysRemaining === 0` (the required-rate concept is moot — see package report). */
  readonly requiredDailyRunRate: number;
  readonly forecastedHotLeads: ForecastScore;
  /** IDR/day, actual spend pace so far. `0` when `daysElapsed === 0`. */
  readonly budgetBurnRate: number;
  readonly projectedBudgetAtEnd: BudgetAllocation;
  readonly onTrackStatus: OnTrackStatus;
  readonly updatedAt: Date;
}

/** A point-in-time snapshot of an Objective's progress, produced by `UpdateProgress` (spec: "ObjectiveProgress (Entity)"). */
export class ObjectiveProgress {
  private constructor(private readonly props: ObjectiveProgressProps) {}

  static create(props: ObjectiveProgressProps): Result<ObjectiveProgress, ValidationError> {
    if (!Number.isInteger(props.currentHotLeads) || props.currentHotLeads < 0) {
      return err(
        new ValidationError(
          `ObjectiveProgress.currentHotLeads must be a non-negative integer, received: ${String(props.currentHotLeads)}`,
        ),
      );
    }
    if (!Number.isInteger(props.daysElapsed) || props.daysElapsed < 0) {
      return err(
        new ValidationError(
          `ObjectiveProgress.daysElapsed must be a non-negative integer, received: ${String(props.daysElapsed)}`,
        ),
      );
    }
    if (!Number.isInteger(props.daysRemaining) || props.daysRemaining < 0) {
      return err(
        new ValidationError(
          `ObjectiveProgress.daysRemaining must be a non-negative integer, received: ${String(props.daysRemaining)}`,
        ),
      );
    }
    if (!Number.isFinite(props.dailyRunRate) || props.dailyRunRate < 0) {
      return err(
        new ValidationError(
          `ObjectiveProgress.dailyRunRate must be a non-negative finite number, received: ${String(props.dailyRunRate)}`,
        ),
      );
    }
    if (!Number.isFinite(props.requiredDailyRunRate) || props.requiredDailyRunRate < 0) {
      return err(
        new ValidationError(
          `ObjectiveProgress.requiredDailyRunRate must be a non-negative finite number, received: ${String(props.requiredDailyRunRate)}`,
        ),
      );
    }
    if (!Number.isFinite(props.budgetBurnRate) || props.budgetBurnRate < 0) {
      return err(
        new ValidationError(
          `ObjectiveProgress.budgetBurnRate must be a non-negative finite number, received: ${String(props.budgetBurnRate)}`,
        ),
      );
    }
    if (!Object.values(OnTrackStatus).includes(props.onTrackStatus)) {
      return err(
        new ValidationError(
          `ObjectiveProgress.onTrackStatus must be a valid OnTrackStatus, received: ${String(props.onTrackStatus)}`,
        ),
      );
    }
    return ok(new ObjectiveProgress({ ...props }));
  }

  get objectiveId(): ObjectiveId {
    return this.props.objectiveId;
  }

  get currentHotLeads(): number {
    return this.props.currentHotLeads;
  }

  get currentSpend(): BudgetAllocation {
    return this.props.currentSpend;
  }

  get daysElapsed(): number {
    return this.props.daysElapsed;
  }

  get daysRemaining(): number {
    return this.props.daysRemaining;
  }

  get progressPercentage(): ProgressPercentage {
    return this.props.progressPercentage;
  }

  get dailyRunRate(): number {
    return this.props.dailyRunRate;
  }

  get requiredDailyRunRate(): number {
    return this.props.requiredDailyRunRate;
  }

  get forecastedHotLeads(): ForecastScore {
    return this.props.forecastedHotLeads;
  }

  get budgetBurnRate(): number {
    return this.props.budgetBurnRate;
  }

  get projectedBudgetAtEnd(): BudgetAllocation {
    return this.props.projectedBudgetAtEnd;
  }

  get onTrackStatus(): OnTrackStatus {
    return this.props.onTrackStatus;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
