import { describe, expect, it } from "vitest";

import { DEFAULT_AI_JUDGE_CONFIG } from "../../../../src/config/AiJudgeConfig.js";
import { OverallScore } from "../../../../src/domain/value-objects/OverallScore.js";

describe("OverallScore", () => {
  it("pinned business-correctness example: nl=8, qual=7, obj=10, close=9, handoff=10, length=9 -> 85.5", () => {
    const overall = OverallScore.fromDimensions(
      {
        naturalLanguage: 8,
        qualification: 7,
        objectionHandling: 10,
        closingAttempt: 9,
        handoffQuality: 10,
        responseLength: 9,
      },
      DEFAULT_AI_JUDGE_CONFIG.weights,
    );
    expect(overall.value).toBeCloseTo(85.5, 10);
  });

  it("all dimensions at 10 -> exactly 100", () => {
    const overall = OverallScore.fromDimensions(
      {
        naturalLanguage: 10,
        qualification: 10,
        objectionHandling: 10,
        closingAttempt: 10,
        handoffQuality: 10,
        responseLength: 10,
      },
      DEFAULT_AI_JUDGE_CONFIG.weights,
    );
    expect(overall.value).toBe(100);
  });

  it("all dimensions at 0 -> exactly 0", () => {
    const overall = OverallScore.fromDimensions(
      {
        naturalLanguage: 0,
        qualification: 0,
        objectionHandling: 0,
        closingAttempt: 0,
        handoffQuality: 0,
        responseLength: 0,
      },
      DEFAULT_AI_JUDGE_CONFIG.weights,
    );
    expect(overall.value).toBe(0);
  });

  it("of() clamps above 100 down to 100", () => {
    expect(OverallScore.of(150).value).toBe(100);
  });

  it("of() clamps below 0 up to 0", () => {
    expect(OverallScore.of(-10).value).toBe(0);
  });

  it("toNumber() matches value", () => {
    const overall = OverallScore.of(42);
    expect(overall.toNumber()).toBe(42);
  });
});
