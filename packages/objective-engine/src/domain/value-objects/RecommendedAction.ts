import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

export type RecommendedActionType = "SCALE" | "PAUSE" | "FIX" | "REFRESH" | "REALLOCATE";
export type RecommendedActionTargetType = "campaign" | "adset" | "ad";
export type RecommendedActionPriority = 1 | 2 | 3;

const ACTION_TYPES: ReadonlySet<string> = new Set([
  "SCALE",
  "PAUSE",
  "FIX",
  "REFRESH",
  "REALLOCATE",
]);
const TARGET_TYPES: ReadonlySet<string> = new Set(["campaign", "adset", "ad"]);
const PRIORITIES: ReadonlySet<number> = new Set([1, 2, 3]);

export interface RecommendedActionInput {
  readonly type: RecommendedActionType;
  readonly targetId: string;
  readonly targetType: RecommendedActionTargetType;
  readonly targetName: string;
  readonly reason: string;
  readonly estimatedLeadGain?: number;
  readonly estimatedBudgetSaving?: number;
  readonly priority: RecommendedActionPriority;
}

/** One item of Samantha's action plan — scale/pause/fix/refresh/reallocate a specific campaign/adset/ad. */
export class RecommendedAction {
  private constructor(private readonly props: RecommendedActionInput) {}

  static create(props: RecommendedActionInput): Result<RecommendedAction, ValidationError> {
    if (!ACTION_TYPES.has(props.type)) {
      return err(
        new ValidationError(
          `RecommendedAction.type must be one of SCALE|PAUSE|FIX|REFRESH|REALLOCATE, received: ${String(props.type)}`,
        ),
      );
    }
    if (!TARGET_TYPES.has(props.targetType)) {
      return err(
        new ValidationError(
          `RecommendedAction.targetType must be one of campaign|adset|ad, received: ${String(props.targetType)}`,
        ),
      );
    }
    if (typeof props.targetId !== "string" || props.targetId.trim().length === 0) {
      return err(new ValidationError("RecommendedAction.targetId must be a non-empty string"));
    }
    if (typeof props.targetName !== "string" || props.targetName.trim().length === 0) {
      return err(new ValidationError("RecommendedAction.targetName must be a non-empty string"));
    }
    if (typeof props.reason !== "string" || props.reason.trim().length === 0) {
      return err(new ValidationError("RecommendedAction.reason must be a non-empty string"));
    }
    if (!PRIORITIES.has(props.priority)) {
      return err(
        new ValidationError(
          `RecommendedAction.priority must be 1, 2, or 3, received: ${String(props.priority)}`,
        ),
      );
    }
    if (
      props.estimatedLeadGain !== undefined &&
      (!Number.isFinite(props.estimatedLeadGain) || props.estimatedLeadGain < 0)
    ) {
      return err(
        new ValidationError(
          `RecommendedAction.estimatedLeadGain must be a non-negative finite number when present, received: ${String(props.estimatedLeadGain)}`,
        ),
      );
    }
    if (
      props.estimatedBudgetSaving !== undefined &&
      (!Number.isFinite(props.estimatedBudgetSaving) || props.estimatedBudgetSaving < 0)
    ) {
      return err(
        new ValidationError(
          `RecommendedAction.estimatedBudgetSaving must be a non-negative finite number when present, received: ${String(props.estimatedBudgetSaving)}`,
        ),
      );
    }
    return ok(new RecommendedAction({ ...props }));
  }

  get type(): RecommendedActionType {
    return this.props.type;
  }

  get targetId(): string {
    return this.props.targetId;
  }

  get targetType(): RecommendedActionTargetType {
    return this.props.targetType;
  }

  get targetName(): string {
    return this.props.targetName;
  }

  get reason(): string {
    return this.props.reason;
  }

  get estimatedLeadGain(): number | undefined {
    return this.props.estimatedLeadGain;
  }

  get estimatedBudgetSaving(): number | undefined {
    return this.props.estimatedBudgetSaving;
  }

  get priority(): RecommendedActionPriority {
    return this.props.priority;
  }
}
