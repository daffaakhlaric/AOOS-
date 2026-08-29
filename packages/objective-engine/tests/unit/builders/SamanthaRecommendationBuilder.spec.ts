import { describe, expect, it } from "vitest";

import { SamanthaRecommendationBuilder } from "../../../src/builders/SamanthaRecommendationBuilder.js";
import { EstimatedImpact } from "../../../src/domain/value-objects/EstimatedImpact.js";
import { ObjectiveId } from "../../../src/domain/value-objects/ObjectiveId.js";
import { RecommendedAction } from "../../../src/domain/value-objects/RecommendedAction.js";
import { unwrap } from "../../helpers/result.js";

describe("SamanthaRecommendationBuilder", () => {
  it("builds a valid default SamanthaRecommendation with 0 confidence, no actions", () => {
    const rec = unwrap(new SamanthaRecommendationBuilder().build());
    expect(rec.actions).toEqual([]);
    expect(rec.confidence).toBe(0);
    expect(rec.summary.length).toBeGreaterThan(0);
  });

  it("withObjectiveId overrides the generated id", () => {
    const id = ObjectiveId.generate();
    const rec = unwrap(new SamanthaRecommendationBuilder().withObjectiveId(id).build());
    expect(rec.objectiveId).toBe(id);
  });

  it("supports every with* method", () => {
    const id = ObjectiveId.generate();
    const generatedAt = new Date("2026-08-10T00:00:00.000Z");
    const action = unwrap(
      RecommendedAction.create({
        type: "PAUSE",
        targetId: "ad-1",
        targetType: "ad",
        targetName: "Ad 1",
        reason: "expensive",
        priority: 1,
      }),
    );
    const impact = unwrap(
      EstimatedImpact.create({
        additionalLeadsEstimate: 5,
        budgetSavingEstimate: 1_000_000,
        targetGapClosedPercentage: 20,
      }),
    );

    const rec = unwrap(
      new SamanthaRecommendationBuilder()
        .withObjectiveId(id)
        .withGeneratedAt(generatedAt)
        .withSummary("custom summary")
        .withActions([action])
        .withEstimatedImpact(impact)
        .withConfidence(75)
        .build(),
    );

    expect(rec.objectiveId).toBe(id);
    expect(rec.generatedAt).toBe(generatedAt);
    expect(rec.summary).toBe("custom summary");
    expect(rec.actions).toEqual([action]);
    expect(rec.estimatedImpact).toBe(impact);
    expect(rec.confidence).toBe(75);
  });

  it("propagates a build() failure from an invalid override (empty summary)", () => {
    const result = new SamanthaRecommendationBuilder().withSummary("").build();
    expect(result.ok).toBe(false);
  });
});
