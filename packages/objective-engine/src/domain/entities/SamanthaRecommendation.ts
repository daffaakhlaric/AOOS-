import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { EstimatedImpact } from "../value-objects/EstimatedImpact.js";
import type { ObjectiveId } from "../value-objects/ObjectiveId.js";
import type { RecommendedAction } from "../value-objects/RecommendedAction.js";

export type { RecommendedAction } from "../value-objects/RecommendedAction.js";

export interface SamanthaRecommendationProps {
  readonly objectiveId: ObjectiveId;
  readonly generatedAt: Date;
  readonly summary: string;
  readonly actions: ReadonlyArray<RecommendedAction>;
  readonly estimatedImpact: EstimatedImpact;
  readonly confidence: number; // 0-100
}

/** Samantha's generated action plan for an Objective, produced by `GenerateRecommendation` (spec: "SamanthaRecommendation (Entity)"). */
export class SamanthaRecommendation {
  private constructor(private readonly props: SamanthaRecommendationProps) {}

  static create(
    props: SamanthaRecommendationProps,
  ): Result<SamanthaRecommendation, ValidationError> {
    if (typeof props.summary !== "string" || props.summary.trim().length === 0) {
      return err(new ValidationError("SamanthaRecommendation.summary must be a non-empty string"));
    }
    if (!Number.isFinite(props.confidence) || props.confidence < 0 || props.confidence > 100) {
      return err(
        new ValidationError(
          `SamanthaRecommendation.confidence must be within 0-100, received: ${String(props.confidence)}`,
        ),
      );
    }
    return ok(new SamanthaRecommendation({ ...props, actions: [...props.actions] }));
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
