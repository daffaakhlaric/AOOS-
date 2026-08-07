import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeRecommendationBuilder } from "../../src/recommendation/knowledge-recommendation-builder.js";
import { RecommendationType } from "../../src/types/recommendation-type.js";
import { resetFixtureState, makeClock } from "../helpers/fixtures.js";

describe("KnowledgeRecommendationBuilder", () => {
  beforeEach(() => resetFixtureState());

  it("builds a recommendation with a default priority", () => {
    const builder = new KnowledgeRecommendationBuilder(makeClock(1000));
    const rec = builder.build({
      type: RecommendationType.Improvement,
      itemIds: ["a"],
      reason: "low quality",
    });
    expect(rec.priority).toBe(50);
    expect(rec.createdAt).toBe(1000);
  });

  it("honors an explicit priority", () => {
    const builder = new KnowledgeRecommendationBuilder(makeClock(1000));
    const rec = builder.build({
      type: RecommendationType.Merge,
      itemIds: ["a", "b"],
      reason: "duplicate",
      priority: 90,
    });
    expect(rec.priority).toBe(90);
  });

  it("assigns unique ids across builds", () => {
    const builder = new KnowledgeRecommendationBuilder(makeClock(0));
    const first = builder.build({ type: RecommendationType.Update, itemIds: ["a"], reason: "x" });
    const second = builder.build({ type: RecommendationType.Update, itemIds: ["a"], reason: "x" });
    expect(first.id).not.toBe(second.id);
  });
});
