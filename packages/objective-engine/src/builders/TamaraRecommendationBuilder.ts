import type { Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import {
  TamaraRecommendation,
  type TamaraRecommendationProps,
} from "../domain/entities/TamaraRecommendation.js";
import { EstimatedImpact } from "../domain/value-objects/EstimatedImpact.js";
import { ObjectiveId } from "../domain/value-objects/ObjectiveId.js";
import type { RecommendedAction } from "../domain/value-objects/RecommendedAction.js";

/** Builder Pattern class for constructing `TamaraRecommendation` entities, mirroring `ObjectiveBuilder`/`@aos/meta-ads-connector`'s `CampaignBuilder` convention. */
export class TamaraRecommendationBuilder {
  private props: TamaraRecommendationProps = {
    objectiveId: ObjectiveId.generate(),
    generatedAt: new Date("2026-08-09T00:00:00.000Z"),
    summary: "Tamara belum memiliki rekomendasi untuk objective ini.",
    actions: [],
    estimatedImpact: unwrapOrThrow(
      EstimatedImpact.create({
        additionalLeadsEstimate: 0,
        budgetSavingEstimate: 0,
        targetGapClosedPercentage: 0,
      }),
    ),
    confidence: 0,
  };

  withObjectiveId(objectiveId: ObjectiveId): this {
    this.props = { ...this.props, objectiveId };
    return this;
  }

  withGeneratedAt(generatedAt: Date): this {
    this.props = { ...this.props, generatedAt };
    return this;
  }

  withSummary(summary: string): this {
    this.props = { ...this.props, summary };
    return this;
  }

  withActions(actions: ReadonlyArray<RecommendedAction>): this {
    this.props = { ...this.props, actions };
    return this;
  }

  withEstimatedImpact(estimatedImpact: EstimatedImpact): this {
    this.props = { ...this.props, estimatedImpact };
    return this;
  }

  withConfidence(confidence: number): this {
    this.props = { ...this.props, confidence };
    return this;
  }

  build(): Result<TamaraRecommendation, ValidationError> {
    return TamaraRecommendation.create(this.props);
  }
}

function unwrapOrThrow<T>(result: Result<T, ValidationError>): T {
  /* v8 ignore next 5 */
  if (!result.ok) {
    throw new Error(
      `TamaraRecommendationBuilder default construction failed: ${result.error.message}`,
    );
  }
  return result.value;
}
