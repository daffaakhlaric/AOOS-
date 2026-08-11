import { Branch, Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { CampaignHealthAnalyzer } from "../../../src/intelligence/CampaignHealthAnalyzer.js";
import type { PerAdFinding } from "../../../src/types/AgentTypes.js";

function finding(verdict: Verdict): PerAdFinding {
  return {
    adId: "ad",
    targetId: "ad",
    targetType: "ad",
    verdict,
    branch: Branch.BINTARO,
    unit: "Xpander",
    spendIDR: 100_000,
    conversations: 10,
    rphChatIDR: 10_000,
    rphD3IDR: 10_000,
  };
}

describe("CampaignHealthAnalyzer", () => {
  it("100% data coverage -> confidence > 80 (pinned business-correctness value)", () => {
    const result = CampaignHealthAnalyzer.analyze([finding(Verdict.SCALE)], 1);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.confidence.isAbove(80)).toBe(true);
  });

  it("significant missing data -> a visibly lower confidence score", () => {
    const full = CampaignHealthAnalyzer.analyze([finding(Verdict.SCALE)], 1);
    const partial = CampaignHealthAnalyzer.analyze([finding(Verdict.SCALE)], 0.1);
    expect(full.ok && partial.ok && partial.value.confidence.toNumber()).toBeLessThan(
      full.ok ? full.value.confidence.toNumber() : 0,
    );
  });

  it("counts every verdict correctly", () => {
    const findings = [
      finding(Verdict.SCALE),
      finding(Verdict.KEEP),
      finding(Verdict.REVIEW),
      finding(Verdict.REFRESH),
      finding(Verdict.FIX),
      finding(Verdict.PAUSE),
    ];
    const result = CampaignHealthAnalyzer.analyze(findings, 0.8);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.scaleCount).toBe(1);
    expect(result.value.keepCount).toBe(1);
    expect(result.value.reviewCount).toBe(1);
    expect(result.value.refreshCount).toBe(1);
    expect(result.value.fixCount).toBe(1);
    expect(result.value.pauseCount).toBe(1);
  });

  it("healthScore is 100 for an all-SCALE/KEEP portfolio", () => {
    const result = CampaignHealthAnalyzer.analyze(
      [finding(Verdict.SCALE), finding(Verdict.KEEP)],
      1,
    );
    expect(result.ok && result.value.healthScore).toBe(100);
  });

  it("healthScore is 0 for an all-PAUSE portfolio", () => {
    const result = CampaignHealthAnalyzer.analyze(
      [finding(Verdict.PAUSE), finding(Verdict.PAUSE)],
      1,
    );
    expect(result.ok && result.value.healthScore).toBe(0);
  });

  it("healthScore is 100 for an empty portfolio (vacuously healthy)", () => {
    const result = CampaignHealthAnalyzer.analyze([], 0);
    expect(result.ok && result.value.healthScore).toBe(100);
  });

  it("rejects a dataCoverageFraction outside [0, 1]", () => {
    const result = CampaignHealthAnalyzer.analyze([], 1.5);
    expect(result.ok).toBe(false);
  });
});
