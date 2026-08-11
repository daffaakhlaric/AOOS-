import { Branch, Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { AudienceInsightEngine } from "../../../src/intelligence/AudienceInsightEngine.js";
import type { PerAdFinding } from "../../../src/types/AgentTypes.js";

function finding(branch: Branch, spendIDR: number, conversations: number): PerAdFinding {
  return {
    adId: `${branch}-${spendIDR}`,
    targetId: "ad",
    targetType: "ad",
    verdict: Verdict.KEEP,
    branch,
    unit: "Xpander",
    spendIDR,
    conversations,
    rphChatIDR: conversations > 0 ? spendIDR / conversations : null,
    rphD3IDR: null,
  };
}

describe("AudienceInsightEngine", () => {
  it("byBranch groups spend/conversations correctly", () => {
    const insights = AudienceInsightEngine.byBranch([
      finding(Branch.CINERE, 100_000, 10),
      finding(Branch.CINERE, 200_000, 20),
      finding(Branch.BANDUNG, 500_000, 5),
    ]);
    const cinere = insights.find((i) => i.branch === Branch.CINERE);
    expect(cinere?.totalSpendIDR).toBe(300_000);
    expect(cinere?.totalConversations).toBe(30);
    expect(cinere?.avgRphChatIDR).toBe(10_000);
  });

  it("byBranch produces a null avgRphChatIDR when a branch has zero conversations", () => {
    const insights = AudienceInsightEngine.byBranch([finding(Branch.BANDUNG, 100_000, 0)]);
    expect(insights[0]?.avgRphChatIDR).toBeNull();
  });

  it("bestRespondingBranch returns the lowest avg Rp/chat branch", () => {
    const insights = AudienceInsightEngine.byBranch([
      finding(Branch.CINERE, 69_190, 10), // 6,919/chat
      finding(Branch.BANDUNG, 426_210, 10), // 42,621/chat
    ]);
    expect(AudienceInsightEngine.bestRespondingBranch(insights)?.branch).toBe(Branch.CINERE);
  });

  it("worstRespondingBranch returns the highest avg Rp/chat branch", () => {
    const insights = AudienceInsightEngine.byBranch([
      finding(Branch.CINERE, 69_190, 10),
      finding(Branch.BANDUNG, 426_210, 10),
    ]);
    expect(AudienceInsightEngine.worstRespondingBranch(insights)?.branch).toBe(Branch.BANDUNG);
  });

  it("bestRespondingBranch/worstRespondingBranch return undefined when no branch has a defined rate", () => {
    const insights = AudienceInsightEngine.byBranch([finding(Branch.CINERE, 100_000, 0)]);
    expect(AudienceInsightEngine.bestRespondingBranch(insights)).toBeUndefined();
    expect(AudienceInsightEngine.worstRespondingBranch(insights)).toBeUndefined();
  });
});
