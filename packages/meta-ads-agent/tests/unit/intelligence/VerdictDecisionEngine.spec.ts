import { Branch, Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { DEFAULT_META_ADS_AGENT_CONFIG } from "../../../src/config/MetaAdsAgentConfig.js";
import { ConfidenceScore } from "../../../src/domain/value-objects/ConfidenceScore.js";
import { DecisionType } from "../../../src/domain/value-objects/DecisionType.js";
import { VerdictDecisionEngine } from "../../../src/intelligence/VerdictDecisionEngine.js";
import type { PerAdFinding } from "../../../src/types/AgentTypes.js";
import { unwrap } from "../../helpers/result.js";

const config = { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG };
const confidence = unwrap(ConfidenceScore.create(90));
const engine = new VerdictDecisionEngine(() => new Date("2026-08-09T00:00:00.000Z"));

/** Pinned business-correctness fixture from the spec's Testing Requirements: avg rphChat = Rp 9.212. */
const AVG_RPH_CHAT = 9212;

function finding(overrides: Partial<PerAdFinding>): PerAdFinding {
  return {
    adId: "ad-1",
    targetId: "ad-1",
    targetType: "ad",
    verdict: Verdict.PAUSE,
    branch: Branch.BINTARO,
    unit: "Xpander Cross 2019",
    spendIDR: 0,
    conversations: 0,
    rphChatIDR: null,
    rphD3IDR: null,
    ...overrides,
  };
}

describe("VerdictDecisionEngine — construction", () => {
  it("uses the real wall clock when no clock is injected", () => {
    const defaultEngine = new VerdictDecisionEngine();
    const result = defaultEngine.decideForAd(
      finding({ verdict: Verdict.FIX }),
      0,
      config,
      confidence,
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.createdAt).toBeInstanceOf(Date);
  });
});

describe("VerdictDecisionEngine — pinned business-correctness thresholds", () => {
  it("Rp 9.212 x 2.5 = Rp 23.030 (exact, AUTO_EXECUTE threshold)", () => {
    expect(Math.round(AVG_RPH_CHAT * config.autoExecutePauseRphMultiple)).toBe(23_030);
  });

  it("Rp 9.212 x 1.8 = Rp 16.582 (rounded, ESCALATE threshold — matches pinned spec value)", () => {
    expect(Math.round(AVG_RPH_CHAT * config.escalateRphMultiple)).toBe(16_582);
  });
});

describe("VerdictDecisionEngine — PAUSE rule chain (ordered, first match wins)", () => {
  it("rule 1: spend === 0 -> NO_ACTION (nothing to save)", () => {
    const result = engine.decideForAd(
      finding({ verdict: Verdict.PAUSE, spendIDR: 0, conversations: 0 }),
      AVG_RPH_CHAT,
      config,
      confidence,
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.decisionType).toBe(DecisionType.NO_ACTION);
  });

  it("rule 2: spend > 0 && conversations === 0 -> AUTO_EXECUTE (wasted spend)", () => {
    const result = engine.decideForAd(
      finding({ verdict: Verdict.PAUSE, spendIDR: 500_000, conversations: 0, rphChatIDR: null }),
      AVG_RPH_CHAT,
      config,
      confidence,
    );
    expect(result.ok && result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
  });

  it("rule 3: rphChat > 2.5x avg -> AUTO_EXECUTE, even when spend is high (precedence over rule 4)", () => {
    const result = engine.decideForAd(
      finding({
        verdict: Verdict.PAUSE,
        spendIDR: 2_000_000,
        conversations: 50,
        rphChatIDR: 25_000, // > 23,030
      }),
      AVG_RPH_CHAT,
      config,
      confidence,
    );
    expect(result.ok && result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
  });

  it("rule 3 exact boundary: rphChat === 23,030 does NOT trigger AUTO_EXECUTE via rule 3 (strictly greater-than)", () => {
    const result = engine.decideForAd(
      finding({
        verdict: Verdict.PAUSE,
        spendIDR: 2_000_000,
        conversations: 50,
        rphChatIDR: 23_030,
      }),
      AVG_RPH_CHAT,
      config,
      confidence,
    );
    // Falls through to rule 4 (still > escalate threshold, high spend) -> ESCALATE.
    expect(result.ok && result.value.decisionType).toBe(DecisionType.ESCALATE);
  });

  it("rule 4: rphChat > 1.8x avg AND spend > Rp 1jt -> ESCALATE", () => {
    const result = engine.decideForAd(
      finding({
        verdict: Verdict.PAUSE,
        spendIDR: 1_500_000,
        conversations: 60,
        rphChatIDR: 18_000, // > 16,582, <= 23,030
      }),
      AVG_RPH_CHAT,
      config,
      confidence,
    );
    expect(result.ok && result.value.decisionType).toBe(DecisionType.ESCALATE);
  });

  it("rule 4 requires BOTH conditions: rphChat over threshold but spend <= Rp 1jt falls through to rule 5", () => {
    const result = engine.decideForAd(
      finding({
        verdict: Verdict.PAUSE,
        spendIDR: 900_000,
        conversations: 50,
        rphChatIDR: 18_000,
      }),
      AVG_RPH_CHAT,
      config,
      confidence,
    );
    expect(result.ok && result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
  });

  it("rule 5: PAUSE verdict matching no risk condition -> AUTO_EXECUTE (safe default)", () => {
    const result = engine.decideForAd(
      finding({
        verdict: Verdict.PAUSE,
        spendIDR: 500_000,
        conversations: 50,
        rphChatIDR: 10_000, // below both thresholds
      }),
      AVG_RPH_CHAT,
      config,
      confidence,
    );
    expect(result.ok && result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
  });

  it("rule 5: PAUSE verdict with a null rphChat and non-zero conversations -> AUTO_EXECUTE (safe default)", () => {
    const result = engine.decideForAd(
      finding({
        verdict: Verdict.PAUSE,
        spendIDR: 200_000,
        conversations: 5,
        rphChatIDR: null,
      }),
      AVG_RPH_CHAT,
      config,
      confidence,
    );
    expect(result.ok && result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
  });
});

describe("VerdictDecisionEngine — SCALE", () => {
  it("budgetIncrease <= maxAutoScaleBudgetIDR (Rp 500k) -> AUTO_EXECUTE", () => {
    const result = engine.decideForAd(
      finding({
        verdict: Verdict.SCALE,
        spendIDR: 300_000,
        conversations: 90,
        budgetIncreaseIDR: 500_000,
        currentDailyBudgetIDR: 2_500_000,
      }),
      AVG_RPH_CHAT,
      config,
      confidence,
    );
    expect(result.ok && result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
    expect(result.ok && result.value.currentDailyBudgetIDR).toBe(2_500_000);
  });

  it("budgetIncrease > maxAutoScaleBudgetIDR (Rp 500k) -> ESCALATE", () => {
    const result = engine.decideForAd(
      finding({
        verdict: Verdict.SCALE,
        spendIDR: 300_000,
        conversations: 90,
        budgetIncreaseIDR: 600_000,
        currentDailyBudgetIDR: 3_000_000,
      }),
      AVG_RPH_CHAT,
      config,
      confidence,
    );
    expect(result.ok && result.value.decisionType).toBe(DecisionType.ESCALATE);
  });

  it("missing budgetIncreaseIDR defaults to 0 -> AUTO_EXECUTE", () => {
    const result = engine.decideForAd(
      finding({ verdict: Verdict.SCALE, spendIDR: 100_000, conversations: 10 }),
      AVG_RPH_CHAT,
      config,
      confidence,
    );
    expect(result.ok && result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
    expect(result.ok && result.value.budgetChangeIDR).toBe(0);
  });

  it("propagates a DecisionError when spendIDR is fractional (fails ImpactEstimate.amountIDR's integer rule)", () => {
    const result = engine.decideForAd(
      finding({
        verdict: Verdict.PAUSE,
        spendIDR: 500_000.5,
        conversations: 0,
      }),
      AVG_RPH_CHAT,
      config,
      confidence,
    );
    expect(result.ok).toBe(false);
  });
});

describe("VerdictDecisionEngine — FIX/REFRESH/KEEP/REVIEW", () => {
  it("FIX -> always AUTO_EXECUTE", () => {
    const result = engine.decideForAd(
      finding({ verdict: Verdict.FIX }),
      AVG_RPH_CHAT,
      config,
      confidence,
    );
    expect(result.ok && result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
    expect(result.ok && result.value.actionKind).toBe("FIX");
  });

  it("REFRESH -> always BRIEF_KAI", () => {
    const result = engine.decideForAd(
      finding({ verdict: Verdict.REFRESH }),
      AVG_RPH_CHAT,
      config,
      confidence,
    );
    expect(result.ok && result.value.decisionType).toBe(DecisionType.BRIEF_KAI);
  });

  it("KEEP -> NO_ACTION (monitor only)", () => {
    const result = engine.decideForAd(
      finding({ verdict: Verdict.KEEP }),
      AVG_RPH_CHAT,
      config,
      confidence,
    );
    expect(result.ok && result.value.decisionType).toBe(DecisionType.NO_ACTION);
  });

  it("REVIEW -> NO_ACTION (monitor only)", () => {
    const result = engine.decideForAd(
      finding({ verdict: Verdict.REVIEW }),
      AVG_RPH_CHAT,
      config,
      confidence,
    );
    expect(result.ok && result.value.decisionType).toBe(DecisionType.NO_ACTION);
  });
});
