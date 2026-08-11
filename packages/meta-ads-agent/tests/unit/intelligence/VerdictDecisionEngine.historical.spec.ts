import { Branch, Funnel, Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { DEFAULT_META_ADS_AGENT_CONFIG } from "../../../src/config/MetaAdsAgentConfig.js";
import { AgentMemory } from "../../../src/domain/entities/AgentMemory.js";
import { AdAngle } from "../../../src/domain/value-objects/AdAngle.js";
import { ConfidenceScore } from "../../../src/domain/value-objects/ConfidenceScore.js";
import { DecisionType } from "../../../src/domain/value-objects/DecisionType.js";
import { performanceBaselineKey } from "../../../src/domain/value-objects/PerformanceBaseline.js";
import { VerdictDecisionEngine } from "../../../src/intelligence/VerdictDecisionEngine.js";
import type { PerAdFinding } from "../../../src/types/AgentTypes.js";
import { unwrap } from "../../helpers/result.js";

const config = { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG };
const confidence = unwrap(ConfidenceScore.create(90));
const engine = new VerdictDecisionEngine(() => new Date("2026-08-09T00:00:00.000Z"));

function finding(overrides: Partial<PerAdFinding>): PerAdFinding {
  return {
    adId: "ad-1",
    targetId: "ad-1",
    targetType: "ad",
    verdict: Verdict.PAUSE,
    branch: Branch.CINERE,
    unit: "Xpander Cross 2019",
    spendIDR: 1_000_000,
    conversations: 5,
    rphChatIDR: null,
    rphD3IDR: null,
    ...overrides,
  };
}

describe("VerdictDecisionEngine — S1 blended avg (pinned business-correctness)", () => {
  it('the spec\'s own worked example ("Rp 9.085.60") is a transposition typo — the correct blended avg for historical=8964, current=9500 is 9285.6', () => {
    const blended = 8964 * 0.4 + 9500 * 0.6;
    expect(blended).toBeCloseTo(9285.6, 5);
    expect(Math.round(blended)).toBe(9286);
  });

  it("uses blended avg (historical 40% + current 60%) instead of the raw current-cycle avg to compute PAUSE thresholds", () => {
    const memory = new AgentMemory();
    const key = performanceBaselineKey(Branch.CINERE, Funnel.CTWA, AdAngle.DP_RINGAN);
    memory.seedPerformanceBaseline(key, {
      branch: Branch.CINERE,
      funnel: Funnel.CTWA,
      angle: AdAngle.DP_RINGAN,
      avgRphChat: 8964,
      sampleSize: 50,
    });

    // blended = 8964*0.4 + 9500*0.6 = 9285.6; autoExecuteThreshold = round(9285.6 * 2.5) = 23214
    // A raw (unblended) avg of 9500 would give threshold round(9500*2.5) = 23750.
    // rphChat = 23300 is ABOVE the blended threshold but BELOW the raw-avg threshold — proves
    // blending, not the raw current-cycle avg, drove the AUTO_EXECUTE classification.
    const result = engine.decideForAd(
      finding({
        verdict: Verdict.PAUSE,
        funnel: Funnel.CTWA,
        angle: AdAngle.DP_RINGAN,
        rphChatIDR: 23_300,
        spendIDR: 1_000_000,
        conversations: 3,
      }),
      9500,
      config,
      confidence,
      memory,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
      expect(result.value.reason.toString()).toContain("Rp 23.214");
    }
  });

  it("falls back to the raw current-cycle avg when no baseline exists for this branch-funnel-angle key", () => {
    const memory = new AgentMemory();
    const result = engine.decideForAd(
      finding({
        verdict: Verdict.PAUSE,
        funnel: Funnel.CTWA,
        angle: AdAngle.DP_RINGAN,
        rphChatIDR: 23_300,
        spendIDR: 1_000_000,
        conversations: 3,
      }),
      9500,
      config,
      confidence,
      memory,
    );
    expect(result.ok).toBe(true);
    // raw threshold = round(9500 * 2.5) = 23750; rphChat 23300 does not exceed it, and spend
    // 1_000_000 <= default highSpendThresholdIDR, so this falls through to the safe-default rule.
    if (result.ok) {
      expect(result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
      expect(result.value.reason.toString()).toContain("default aman");
    }
  });

  it("falls back to the raw avg when a baseline exists but has no avgRphChat recorded (e.g. a coarse KNOWN_PERFORMANCE_BASELINES seed entry)", () => {
    const memory = new AgentMemory();
    const key = performanceBaselineKey(Branch.CINERE, Funnel.CTWA, AdAngle.DP_RINGAN);
    memory.seedPerformanceBaseline(key, {
      branch: Branch.CINERE,
      funnel: Funnel.CTWA,
      avgRphLead: 6919,
      sampleSize: 227,
    });
    const result = engine.decideForAd(
      finding({ verdict: Verdict.PAUSE, funnel: Funnel.CTWA, rphChatIDR: null }),
      9500,
      config,
      confidence,
      memory,
    );
    expect(result.ok).toBe(true);
  });

  it("does not blend when funnel/angle are not supplied on the finding (backward-compatible default)", () => {
    const memory = new AgentMemory();
    const key = performanceBaselineKey(Branch.CINERE, Funnel.CTWA, AdAngle.DP_RINGAN);
    memory.seedPerformanceBaseline(key, {
      branch: Branch.CINERE,
      funnel: Funnel.CTWA,
      angle: AdAngle.DP_RINGAN,
      avgRphChat: 8964,
      sampleSize: 50,
    });
    const result = engine.decideForAd(
      finding({ verdict: Verdict.PAUSE, rphChatIDR: 23_300 }),
      9500,
      config,
      confidence,
      memory,
    );
    expect(result.ok).toBe(true);
    // No blending applied (finding.funnel/.angle absent) → raw threshold 23750 not exceeded.
    if (result.ok) {
      expect(result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
      expect(result.value.reason.toString()).toContain("default aman");
    }
  });
});

describe("VerdictDecisionEngine — S1 evergreen protection (pinned business-correctness)", () => {
  it("evergreen ad, active 65 days, rphChat Rp 9.500 (borderline) — PAUSE verdict overrides to ESCALATE, not AUTO_EXECUTE", () => {
    const memory = new AgentMemory();
    memory.markEvergreen("ad-evergreen-1");

    const result = engine.decideForAd(
      finding({
        adId: "ad-evergreen-1",
        targetId: "ad-evergreen-1",
        verdict: Verdict.PAUSE,
        rphChatIDR: 9_500,
        spendIDR: 2_000_000,
        conversations: 2,
      }),
      9212,
      config,
      confidence,
      memory,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.decisionType).toBe(DecisionType.ESCALATE);
      expect(result.value.reason.toString()).toContain("Evergreen");
    }
  });

  it("evergreen + spend === 0 -> still NO_ACTION (nothing to protect, rule 1 fires before the evergreen check)", () => {
    const memory = new AgentMemory();
    memory.markEvergreen("ad-evergreen-2");
    const result = engine.decideForAd(
      finding({
        adId: "ad-evergreen-2",
        targetId: "ad-evergreen-2",
        verdict: Verdict.PAUSE,
        spendIDR: 0,
      }),
      9212,
      config,
      confidence,
      memory,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.decisionType).toBe(DecisionType.NO_ACTION);
  });

  it("evergreen + wasted spend (conversations === 0) -> ESCALATE (protection wins over what would otherwise be AUTO_EXECUTE)", () => {
    const memory = new AgentMemory();
    memory.markEvergreen("ad-evergreen-3");
    const result = engine.decideForAd(
      finding({
        adId: "ad-evergreen-3",
        targetId: "ad-evergreen-3",
        verdict: Verdict.PAUSE,
        spendIDR: 500_000,
        conversations: 0,
        rphChatIDR: null,
      }),
      9212,
      config,
      confidence,
      memory,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.decisionType).toBe(DecisionType.ESCALATE);
  });

  it("evergreen + very-high rphChat (> 2.5x avg) -> ESCALATE (protection wins over the 'very clearly boros' AUTO_EXECUTE)", () => {
    const memory = new AgentMemory();
    memory.markEvergreen("ad-evergreen-4");
    const result = engine.decideForAd(
      finding({
        adId: "ad-evergreen-4",
        targetId: "ad-evergreen-4",
        verdict: Verdict.PAUSE,
        spendIDR: 3_000_000,
        conversations: 1,
        rphChatIDR: 50_000,
      }),
      9212,
      config,
      confidence,
      memory,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.decisionType).toBe(DecisionType.ESCALATE);
  });

  it("non-evergreen ads are completely unaffected by the evergreen check", () => {
    const memory = new AgentMemory();
    memory.markEvergreen("some-other-ad");
    const result = engine.decideForAd(
      finding({
        adId: "ad-normal",
        targetId: "ad-normal",
        verdict: Verdict.PAUSE,
        spendIDR: 500_000,
        conversations: 0,
        rphChatIDR: null,
      }),
      9212,
      config,
      confidence,
      memory,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
      expect(result.value.reason.toString()).not.toContain("Evergreen");
    }
  });

  it("no memory supplied -> evergreen check never triggers (backward-compatible default)", () => {
    const result = engine.decideForAd(
      finding({ verdict: Verdict.PAUSE, spendIDR: 500_000, conversations: 0, rphChatIDR: null }),
      9212,
      config,
      confidence,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
  });
});
