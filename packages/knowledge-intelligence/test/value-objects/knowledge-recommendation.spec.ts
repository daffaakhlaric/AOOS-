import { describe, expect, it } from "vitest";

import { RecommendationType } from "../../src/types/recommendation-type.js";
import { KnowledgeRecommendation } from "../../src/value-objects/knowledge-recommendation.js";

describe("KnowledgeRecommendation", () => {
  it("constructs a valid recommendation", () => {
    const rec = new KnowledgeRecommendation({
      id: "rec-1",
      type: RecommendationType.Merge,
      itemIds: ["a", "b"],
      reason: "near-identical",
      priority: 90,
      createdAt: 1000,
    });
    expect(rec.itemIds).toEqual(["a", "b"]);
  });

  it("is frozen (immutable), including itemIds", () => {
    const rec = new KnowledgeRecommendation({
      id: "rec-1",
      type: RecommendationType.Update,
      itemIds: ["a"],
      reason: "stale",
      priority: 50,
      createdAt: 1000,
    });
    expect(Object.isFrozen(rec)).toBe(true);
    expect(Object.isFrozen(rec.itemIds)).toBe(true);
  });

  it("throws when itemIds is empty", () => {
    expect(
      () =>
        new KnowledgeRecommendation({
          id: "rec-1",
          type: RecommendationType.Improvement,
          itemIds: [],
          reason: "x",
          priority: 50,
          createdAt: 0,
        }),
    ).toThrow(RangeError);
  });

  it("throws when priority is out of [0, 100]", () => {
    expect(
      () =>
        new KnowledgeRecommendation({
          id: "rec-1",
          type: RecommendationType.Improvement,
          itemIds: ["a"],
          reason: "x",
          priority: 101,
          createdAt: 0,
        }),
    ).toThrow(RangeError);
  });
});
