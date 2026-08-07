import { describe, expect, it } from "vitest";

import { KnowledgeReadinessScore } from "../../src/value-objects/knowledge-readiness-score.js";

describe("KnowledgeReadinessScore", () => {
  it("constructs a valid readiness score", () => {
    const score = new KnowledgeReadinessScore({
      value: 80,
      band: "ready",
      readyItemCount: 8,
      totalItemCount: 10,
    });
    expect(score.readyItemCount).toBe(8);
    expect(score.totalItemCount).toBe(10);
  });

  it("is frozen (immutable)", () => {
    expect(
      Object.isFrozen(
        new KnowledgeReadinessScore({ value: 1, band: "x", readyItemCount: 0, totalItemCount: 0 }),
      ),
    ).toBe(true);
  });

  it("throws when value is outside [0, 100]", () => {
    expect(
      () =>
        new KnowledgeReadinessScore({ value: -1, band: "x", readyItemCount: 0, totalItemCount: 0 }),
    ).toThrow(RangeError);
  });

  it("throws when readyItemCount exceeds totalItemCount", () => {
    expect(
      () =>
        new KnowledgeReadinessScore({ value: 50, band: "x", readyItemCount: 5, totalItemCount: 2 }),
    ).toThrow(RangeError);
  });

  it("throws when readyItemCount is negative", () => {
    expect(
      () =>
        new KnowledgeReadinessScore({
          value: 50,
          band: "x",
          readyItemCount: -1,
          totalItemCount: 2,
        }),
    ).toThrow(RangeError);
  });
});
