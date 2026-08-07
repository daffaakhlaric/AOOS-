import { describe, expect, it } from "vitest";

import { KnowledgeIntelligenceSnapshot } from "../../src/entities/knowledge-intelligence-snapshot.js";

describe("KnowledgeIntelligenceSnapshot", () => {
  it("constructs a valid snapshot", () => {
    const snapshot = new KnowledgeIntelligenceSnapshot({
      id: "snapshot-1",
      takenAt: 1000,
      itemCount: 10,
      averageHealthScore: 80,
      duplicateCount: 1,
      gapCount: 2,
      recommendationCount: 3,
    });
    expect(snapshot.itemCount).toBe(10);
  });

  it("is frozen (immutable)", () => {
    const snapshot = new KnowledgeIntelligenceSnapshot({
      id: "snapshot-1",
      takenAt: 0,
      itemCount: 0,
      averageHealthScore: 0,
      duplicateCount: 0,
      gapCount: 0,
      recommendationCount: 0,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it("throws for an empty id", () => {
    expect(
      () =>
        new KnowledgeIntelligenceSnapshot({
          id: " ",
          takenAt: 0,
          itemCount: 0,
          averageHealthScore: 0,
          duplicateCount: 0,
          gapCount: 0,
          recommendationCount: 0,
        }),
    ).toThrow(RangeError);
  });
});
