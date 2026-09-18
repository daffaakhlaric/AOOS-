import { Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import type { SamanthaDecision } from "../../campaign-health/domain/decision.js";
import type { AnglePerformanceResult } from "../../creative-memory/domain/angle-performance.js";

import {
  detectCreativeWinnerOpportunities,
  detectScalingOpportunity,
  SCALING_OPPORTUNITY_MIN_CONFIDENCE,
} from "./opportunity.js";

const CAMPAIGN_ID = "meta-cmp-1";

function makeDecision(overrides: Partial<SamanthaDecision> = {}): SamanthaDecision {
  return {
    decision: Verdict.SCALE,
    confidence: 0.9,
    impact: "LOW",
    reason: "Root cause CPL_IMPROVEMENT terdeteksi.",
    riskOfDoingNothing: "Momentum performa positif berpotensi tidak dimanfaatkan secara maksimal.",
    expectedOutcome: "Scaling berpotensi memperbesar hasil positif.",
    monitoringPlan: { reviewAfterHours: 72, successConditions: [], rollbackConditions: [] },
    ...overrides,
  };
}

describe("detectScalingOpportunity", () => {
  it("fires for Verdict.SCALE at/above the confidence threshold", () => {
    const decision = makeDecision({ decision: Verdict.SCALE, confidence: 0.9 });
    const result = detectScalingOpportunity(CAMPAIGN_ID, decision);

    expect(result).toBeDefined();
    expect(result?.type).toBe("SCALING_OPPORTUNITY");
    expect(result?.confidence).toBe(0.9);
    expect(result?.description).toContain(CAMPAIGN_ID);
    expect(result?.evidence).toContain("90%");
  });

  it("fires exactly at the confidence threshold (>=, not >)", () => {
    const decision = makeDecision({
      decision: Verdict.SCALE,
      confidence: SCALING_OPPORTUNITY_MIN_CONFIDENCE,
    });
    const result = detectScalingOpportunity(CAMPAIGN_ID, decision);
    expect(result).toBeDefined();
  });

  it("does not fire for Verdict.SCALE below the confidence threshold", () => {
    const decision = makeDecision({ decision: Verdict.SCALE, confidence: 0.5 });
    const result = detectScalingOpportunity(CAMPAIGN_ID, decision);
    expect(result).toBeUndefined();
  });

  it.each([
    "NO_ACTION",
    "MONITOR",
    "REQUEST_KAI_CREATIVE",
    Verdict.PAUSE,
    Verdict.REFRESH,
    Verdict.REVIEW,
    Verdict.FIX,
    Verdict.KEEP,
  ] as const)(
    "does not fire for RecommendedActionType %s even at high confidence",
    (decisionType) => {
      const decision = makeDecision({ decision: decisionType, confidence: 0.99 });
      const result = detectScalingOpportunity(CAMPAIGN_ID, decision);
      expect(result).toBeUndefined();
    },
  );
});

function makeAngle(overrides: Partial<AnglePerformanceResult> = {}): AnglePerformanceResult {
  return {
    angle: "family-friendly",
    packageCount: 3,
    aggregated: {
      spend: 1_000_000,
      impressions: 25_000,
      clicks: 500,
      reach: 20_000,
      leads: 20,
      cpl: 50_000,
    },
    dataSufficiency: { level: "HIGH", score: 90, reasons: [] },
    rank: 1,
    ...overrides,
  };
}

describe("detectCreativeWinnerOpportunities", () => {
  it("fires only for the angle at rank 1 among multiple angles", () => {
    const angles = [
      makeAngle({ angle: "family-friendly", rank: 1 }),
      makeAngle({ angle: "investment", rank: 2 }),
      makeAngle({ angle: "luxury", rank: 3 }),
    ];
    const result = detectCreativeWinnerOpportunities(angles);

    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("CREATIVE_WINNER_EXPANSION");
    expect(result[0]?.description).toContain("family-friendly");
    expect(result[0]?.evidence).toContain("Rp50000");
  });

  it("returns [] when no angle has rank === 1 (all unranked, insufficient data)", () => {
    const angles = [
      makeAngle({
        angle: "family-friendly",
        rank: undefined,
        dataSufficiency: { level: "LOW", score: 20, reasons: ["low"] },
      }),
      makeAngle({
        angle: "investment",
        rank: undefined,
        dataSufficiency: { level: "LOW", score: 10, reasons: ["low"] },
      }),
    ];
    const result = detectCreativeWinnerOpportunities(angles);
    expect(result).toEqual([]);
  });

  it("returns [] for an empty angle list", () => {
    expect(detectCreativeWinnerOpportunities([])).toEqual([]);
  });

  it("uses the angle's real dataSufficiency.score as confidence, not a fabricated flat value", () => {
    const angles = [makeAngle({ dataSufficiency: { level: "MEDIUM", score: 65, reasons: [] } })];
    const result = detectCreativeWinnerOpportunities(angles);
    expect(result[0]?.confidence).toBe(0.65);
  });

  it("handles an undefined CPL (zero-lead winner) without fabricating a number", () => {
    const angles = [
      makeAngle({
        aggregated: {
          spend: 500_000,
          impressions: 25_000,
          clicks: 500,
          reach: 20_000,
          leads: 0,
          cpl: undefined,
        },
      }),
    ];
    const result = detectCreativeWinnerOpportunities(angles);
    expect(result[0]?.evidence).toContain("tidak diketahui");
  });
});
