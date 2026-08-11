import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

export interface EstimatedImpactInput {
  /** Sum of every action's `estimatedLeadGain`, i.e. the recommendation algorithm's step 6 ("estimate lead gain from reallocation"). */
  readonly additionalLeadsEstimate: number;
  /** Sum of every action's `estimatedBudgetSaving`, i.e. step 4 ("calculate budget freed from PAUSE"). */
  readonly budgetSavingEstimate: number;
  /** How much closer to `targetHotLeads` this recommendation, if fully executed, is projected to bring the Objective — 0-100, i.e. step 7 ("check if reallocation closes the gap to target"). */
  readonly targetGapClosedPercentage: number;
}

/**
 * The projected effect of executing a `TamaraRecommendation`'s actions, referenced but not
 * detailed by the spec's `TamaraRecommendation.estimatedImpact` field. Shape chosen to map 1:1
 * onto the recommendation algorithm's own steps 4/6/7 so every field has a traceable source.
 */
export class EstimatedImpact {
  private constructor(private readonly props: EstimatedImpactInput) {}

  static create(props: EstimatedImpactInput): Result<EstimatedImpact, ValidationError> {
    if (!Number.isFinite(props.additionalLeadsEstimate) || props.additionalLeadsEstimate < 0) {
      return err(
        new ValidationError(
          `EstimatedImpact.additionalLeadsEstimate must be a non-negative finite number, received: ${String(props.additionalLeadsEstimate)}`,
        ),
      );
    }
    if (!Number.isFinite(props.budgetSavingEstimate) || props.budgetSavingEstimate < 0) {
      return err(
        new ValidationError(
          `EstimatedImpact.budgetSavingEstimate must be a non-negative finite number, received: ${String(props.budgetSavingEstimate)}`,
        ),
      );
    }
    if (
      !Number.isFinite(props.targetGapClosedPercentage) ||
      props.targetGapClosedPercentage < 0 ||
      props.targetGapClosedPercentage > 100
    ) {
      return err(
        new ValidationError(
          `EstimatedImpact.targetGapClosedPercentage must be within 0-100, received: ${String(props.targetGapClosedPercentage)}`,
        ),
      );
    }
    return ok(new EstimatedImpact({ ...props }));
  }

  get additionalLeadsEstimate(): number {
    return this.props.additionalLeadsEstimate;
  }

  get budgetSavingEstimate(): number {
    return this.props.budgetSavingEstimate;
  }

  get targetGapClosedPercentage(): number {
    return this.props.targetGapClosedPercentage;
  }
}
