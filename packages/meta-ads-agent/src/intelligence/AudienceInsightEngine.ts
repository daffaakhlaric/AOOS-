import type { Branch } from "@aos/meta-ads-connector";

import type { PerAdFinding } from "../types/AgentTypes.js";

export interface BranchInsight {
  readonly branch: Branch;
  readonly totalSpendIDR: number;
  readonly totalConversations: number;
  readonly avgRphChatIDR: number | null;
}

/** Groups per-ad findings by branch and ranks who is responding — "which branch/audience is converting cheapest". */
export class AudienceInsightEngine {
  static byBranch(findings: ReadonlyArray<PerAdFinding>): ReadonlyArray<BranchInsight> {
    const groups = new Map<Branch, { spend: number; conversations: number }>();
    for (const finding of findings) {
      const bucket = groups.get(finding.branch) ?? { spend: 0, conversations: 0 };
      bucket.spend += finding.spendIDR;
      bucket.conversations += finding.conversations;
      groups.set(finding.branch, bucket);
    }
    const insights: BranchInsight[] = [];
    for (const [branch, bucket] of groups) {
      insights.push({
        branch,
        totalSpendIDR: bucket.spend,
        totalConversations: bucket.conversations,
        avgRphChatIDR:
          bucket.conversations > 0 ? Math.round(bucket.spend / bucket.conversations) : null,
      });
    }
    return insights;
  }

  /** The branch with the lowest defined avg Rp/chat — cheapest, best-responding audience. Undefined when no branch has a defined rate. */
  static bestRespondingBranch(insights: ReadonlyArray<BranchInsight>): BranchInsight | undefined {
    const withRate = insights.filter((i) => i.avgRphChatIDR !== null);
    if (withRate.length === 0) {
      return undefined;
    }
    // `withRate` is already filtered to entries with a non-null `avgRphChatIDR` — asserted, not defaulted.
    return [...withRate].sort(
      (a, b) => (a.avgRphChatIDR as number) - (b.avgRphChatIDR as number),
    )[0];
  }

  /** The branch with the highest defined avg Rp/chat — most expensive, worst-responding audience. Undefined when no branch has a defined rate. */
  static worstRespondingBranch(insights: ReadonlyArray<BranchInsight>): BranchInsight | undefined {
    const withRate = insights.filter((i) => i.avgRphChatIDR !== null);
    if (withRate.length === 0) {
      return undefined;
    }
    // `withRate` is already filtered to entries with a non-null `avgRphChatIDR` — asserted, not defaulted.
    return [...withRate].sort(
      (a, b) => (b.avgRphChatIDR as number) - (a.avgRphChatIDR as number),
    )[0];
  }
}
