import { Branch, Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import type { PerAdFinding } from "../../../src/types/AgentTypes.js";
import { PerformanceRanker } from "../../../src/utils/PerformanceRanker.js";

function finding(adId: string, rphChatIDR: number | null, conversations: number): PerAdFinding {
  return {
    adId,
    targetId: adId,
    targetType: "ad",
    verdict: Verdict.KEEP,
    branch: Branch.BINTARO,
    unit: "Xpander",
    spendIDR: 100_000,
    conversations,
    rphChatIDR,
    rphD3IDR: null,
  };
}

describe("PerformanceRanker", () => {
  it("byRphChatAscending sorts cheapest first and excludes undefined rates", () => {
    const findings = [finding("a", 5_000, 10), finding("b", 2_000, 10), finding("c", null, 0)];
    const ranked = PerformanceRanker.byRphChatAscending(findings);
    expect(ranked.map((f) => f.adId)).toEqual(["b", "a"]);
  });

  it("topPerformers returns the N cheapest, formatted for the digest", () => {
    const findings = [finding("a", 5_000, 158), finding("b", 2_851, 158)];
    const top = PerformanceRanker.topPerformers(findings, 1);
    expect(top).toEqual([{ label: "b", rphChatIDR: 2_851, conversations: 158 }]);
  });
});
