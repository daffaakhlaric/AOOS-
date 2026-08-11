import { describe, expect, it } from "vitest";

import { DEFAULT_AI_JUDGE_CONFIG, parseAiJudgeConfig } from "../../../src/config/AiJudgeConfig.js";

describe("AiJudgeConfig", () => {
  it("DEFAULT_AI_JUDGE_CONFIG matches the spec's literal weights exactly", () => {
    expect(DEFAULT_AI_JUDGE_CONFIG.weights).toEqual({
      naturalLanguage: 0.2,
      qualification: 0.25,
      objectionHandling: 0.15,
      closingAttempt: 0.2,
      handoffQuality: 0.1,
      responseLength: 0.1,
    });
  });

  it("weights sum to exactly 1.0", () => {
    const sum = Object.values(DEFAULT_AI_JUDGE_CONFIG.weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("default approveThreshold is 80", () => {
    expect(DEFAULT_AI_JUDGE_CONFIG.approveThreshold).toBe(80);
  });

  it("default goldenThreshold is 85", () => {
    expect(DEFAULT_AI_JUDGE_CONFIG.goldenThreshold).toBe(85);
  });

  it("parseAiJudgeConfig(undefined) succeeds with the fully-defaulted config", () => {
    const result = parseAiJudgeConfig(undefined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tenantId).toBe("tenant-dss-motor");
    }
  });

  it("parseAiJudgeConfig rejects an empty tenantId", () => {
    const result = parseAiJudgeConfig({ tenantId: "" });
    expect(result.ok).toBe(false);
  });

  it("parseAiJudgeConfig rejects weights that do not sum to 1.0", () => {
    const result = parseAiJudgeConfig({ weights: { naturalLanguage: 0.5 } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("must sum to 1.0");
    }
  });

  it("parseAiJudgeConfig accepts custom weights that do sum to 1.0", () => {
    const result = parseAiJudgeConfig({
      weights: {
        naturalLanguage: 0.5,
        qualification: 0.1,
        objectionHandling: 0.1,
        closingAttempt: 0.1,
        handoffQuality: 0.1,
        responseLength: 0.1,
      },
    });
    expect(result.ok).toBe(true);
  });
});
