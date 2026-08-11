import { Branch, Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { AudienceInsightEngine } from "../../../src/intelligence/AudienceInsightEngine.js";
import { BudgetOptimizer } from "../../../src/intelligence/BudgetOptimizer.js";
import type { PerAdFinding } from "../../../src/types/AgentTypes.js";

function finding(overrides: Partial<PerAdFinding>): PerAdFinding {
  return {
    adId: "ad",
    targetId: "ad",
    targetType: "ad",
    verdict: Verdict.PAUSE,
    branch: Branch.BINTARO,
    unit: "Xpander",
    spendIDR: 0,
    conversations: 0,
    rphChatIDR: null,
    rphD3IDR: null,
    ...overrides,
  };
}

describe("BudgetOptimizer.freedFromPause", () => {
  it("sums spend of every PAUSE-verdict finding — freed Rp 5.22jt from PAUSE (fixture-specific total, verified by direct sum)", () => {
    const pauseFindings = [
      finding({ adId: "a", spendIDR: 2_000_000 }),
      finding({ adId: "b", spendIDR: 1_500_000 }),
      finding({ adId: "c", spendIDR: 1_720_000 }),
    ];
    const nonPause = finding({ adId: "d", verdict: Verdict.SCALE, spendIDR: 999_999_999 });
    const total = BudgetOptimizer.freedFromPause([...pauseFindings, nonPause]);
    expect(total).toBe(5_220_000);
  });

  it("returns 0 when there are no PAUSE findings", () => {
    expect(BudgetOptimizer.freedFromPause([finding({ verdict: Verdict.KEEP })])).toBe(0);
  });
});

describe("BudgetOptimizer.topScaleCandidates", () => {
  it("returns the N best (lowest Rp/chat) SCALE findings, allocating to top 3", () => {
    const candidates = [
      finding({ adId: "a", verdict: Verdict.SCALE, rphChatIDR: 5_000 }),
      finding({ adId: "b", verdict: Verdict.SCALE, rphChatIDR: 2_000 }),
      finding({ adId: "c", verdict: Verdict.SCALE, rphChatIDR: 8_000 }),
      finding({ adId: "d", verdict: Verdict.SCALE, rphChatIDR: 3_000 }),
    ];
    const top3 = BudgetOptimizer.topScaleCandidates(candidates, 3);
    expect(top3.map((f) => f.adId)).toEqual(["b", "d", "a"]);
  });

  it("excludes non-SCALE findings", () => {
    const candidates = [finding({ verdict: Verdict.PAUSE, rphChatIDR: 1_000 })];
    expect(BudgetOptimizer.topScaleCandidates(candidates, 3)).toHaveLength(0);
  });

  it("sorts findings with a null rphChat last", () => {
    const candidates = [
      finding({ adId: "defined", verdict: Verdict.SCALE, rphChatIDR: 5_000 }),
      finding({ adId: "undefined-rate", verdict: Verdict.SCALE, rphChatIDR: null }),
    ];
    const ranked = BudgetOptimizer.topScaleCandidates(candidates, 2);
    expect(ranked.map((f) => f.adId)).toEqual(["defined", "undefined-rate"]);
  });

  it("treats two null-rphChat findings as equal (both sort to the end, in original relative order)", () => {
    const candidates = [
      finding({ adId: "null-a", verdict: Verdict.SCALE, rphChatIDR: null }),
      finding({ adId: "null-b", verdict: Verdict.SCALE, rphChatIDR: null }),
    ];
    const ranked = BudgetOptimizer.topScaleCandidates(candidates, 2);
    expect(ranked.map((f) => f.adId)).toEqual(["null-a", "null-b"]);
  });
});

describe("BudgetOptimizer.proposeBranchReallocation", () => {
  it("proposes reallocating from the worst to the best branch — digest example: Bandung Rp 42.621/lead vs Cinere Rp 6.919/lead", () => {
    const insights = AudienceInsightEngine.byBranch([
      finding({ adId: "cinere", branch: Branch.CINERE, spendIDR: 69_190, conversations: 10 }),
      finding({ adId: "bandung", branch: Branch.BANDUNG, spendIDR: 426_210, conversations: 10 }),
    ]);
    const proposals = BudgetOptimizer.proposeBranchReallocation(insights);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.fromLabel).toBe(Branch.BANDUNG);
    expect(proposals[0]?.toLabel).toBe(Branch.CINERE);
    expect(proposals[0]?.reallocationAmountIDR).toBe(Math.round(426_210 * 0.2));
  });

  it("returns [] when fewer than 2 branches have a defined rate", () => {
    const insights = AudienceInsightEngine.byBranch([
      finding({ branch: Branch.CINERE, spendIDR: 100_000, conversations: 10 }),
    ]);
    expect(BudgetOptimizer.proposeBranchReallocation(insights)).toEqual([]);
  });

  it("returns [] when worst and best are the same branch", () => {
    const insights = AudienceInsightEngine.byBranch([
      finding({ branch: Branch.CINERE, spendIDR: 100_000, conversations: 10 }),
    ]);
    // Force a single-branch "2 entries" scenario is impossible via byBranch (one row per branch);
    // exercise the equality guard directly.
    expect(BudgetOptimizer.proposeBranchReallocation([...insights, ...insights])).toEqual([]);
  });

  it("returns [] when the computed reallocation amount would be 0", () => {
    const insights = AudienceInsightEngine.byBranch([
      finding({ branch: Branch.CINERE, spendIDR: 0, conversations: 1 }),
      finding({ branch: Branch.BANDUNG, spendIDR: 10, conversations: 1 }),
    ]);
    expect(BudgetOptimizer.proposeBranchReallocation(insights, 0)).toEqual([]);
  });
});
