import { describe, expect, it } from "vitest";

import type { DimensionScore } from "../../../../src/domain/entities/DimensionScore.js";
import { DimensionName } from "../../../../src/domain/value-objects/DimensionName.js";
import { DimensionScoreValue } from "../../../../src/domain/value-objects/DimensionScoreValue.js";

describe("DimensionScore", () => {
  it("holds a dimension name, a clamped score, and the rule breakdown that produced it", () => {
    const dimensionScore: DimensionScore = {
      dimension: DimensionName.NATURAL_LANGUAGE,
      score: DimensionScoreValue.of(7),
      appliedRules: [{ rule: "CONCISE", points: 2, note: "ok" }],
    };
    expect(dimensionScore.score.value).toBe(7);
    expect(dimensionScore.appliedRules).toHaveLength(1);
  });

  it("score is always clamped 0-10 even if a scorer computed an out-of-range raw total", () => {
    const dimensionScore: DimensionScore = {
      dimension: DimensionName.QUALIFICATION,
      score: DimensionScoreValue.of(999),
      appliedRules: [],
    };
    expect(dimensionScore.score.value).toBe(10);
  });
});
