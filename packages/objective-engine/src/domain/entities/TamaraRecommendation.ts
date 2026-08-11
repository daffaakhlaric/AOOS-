import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { EstimatedImpact } from "../value-objects/EstimatedImpact.js";
import type { ObjectiveId } from "../value-objects/ObjectiveId.js";
import type { RecommendedAction } from "../value-objects/RecommendedAction.js";

export type { RecommendedAction } from "../value-objects/RecommendedAction.js";

export interface TamaraRecommendationProps {
  readonly objectiveId: ObjectiveId;
  readonly generatedAt: Date;
  readonly summary: string;
  readonly actions: ReadonlyArray<RecommendedAction>;
  readonly estimatedImpact: EstimatedImpact;
  readonly confidence: number; // 0-100
}

/** Tamara's generated action plan for an Objective, produced by `GenerateRecommendation` (spec: "TamaraRecommendation (Entity)"). */
export class TamaraRecommendation {
  private constructor(private readonly props: TamaraRecommendationProps) {}

  static create(props: TamaraRecommendationProps): Result<TamaraRecommendation, ValidationError> {
    if (typeof props.summary !== "string" || props.summary.trim().length === 0) {
      return err(new ValidationError("TamaraRecommendation.summary must be a non-empty string"));
    }
    if (!Number.isFinite(props.confidence) || props.confidence < 0 || props.confidence > 100) {
      return err(
        new ValidationError(
          `TamaraRecommendation.confidence must be within 0-100, received: ${String(props.confidence)}`,
        ),
      );
    }
    return ok(new TamaraRecommendation({ ...props, actions: [...props.actions] }));
  }

  get objectiveId(): ObjectiveId {
    return this.props.objectiveId;
  }

  get generatedAt(): Date {
    return this.props.generatedAt;
  }

  get summary(): string {
    return this.props.summary;
  }

  get actions(): ReadonlyArray<RecommendedAction> {
    return this.props.actions;
  }

  get estimatedImpact(): EstimatedImpact {
    return this.props.estimatedImpact;
  }

  get confidence(): number {
    return this.props.confidence;
  }
}
