import { Verdict } from "@aos/meta-ads-connector";

import type { PerAdFinding, PortfolioFinding } from "../types/AgentTypes.js";

import type { BranchInsight } from "./AudienceInsightEngine.js";

/**
 * Portfolio-level budget optimization — computes spend freed by PAUSE decisions, ranks SCALE
 * candidates for reallocation, and proposes cross-branch reallocations when one branch is
 * significantly more expensive per chat than another (spec digest example: "Realokasi Rp 3.1
 * juta dari Bandung → Cinere+Bintaro"). All monetary outputs are whole-IDR integers.
 */
export class BudgetOptimizer {
  /** Total spend of every PAUSE-verdict finding — the budget Tamara frees up this cycle. */
  static freedFromPause(findings: ReadonlyArray<PerAdFinding>): number {
    return findings
      .filter((f) => f.verdict === Verdict.PAUSE)
      .reduce((sum, f) => sum + f.spendIDR, 0);
  }

  /** The `count` best (lowest Rp/chat) SCALE-verdict findings — Tamara's top reallocation targets. Findings with a `null` rphChat sort last. */
  static topScaleCandidates(
    findings: ReadonlyArray<PerAdFinding>,
    count: number,
  ): ReadonlyArray<PerAdFinding> {
    return [...findings]
      .filter((f) => f.verdict === Verdict.SCALE)
      .sort(
        (a, b) =>
          (a.rphChatIDR ?? Number.POSITIVE_INFINITY) - (b.rphChatIDR ?? Number.POSITIVE_INFINITY),
      )
      .slice(0, count);
  }

  /**
   * Proposes reallocating a fraction (default 20%) of the worst-responding branch's spend to the
   * best-responding branch, whenever both are defined and distinct. Returns `[]` when there is
   * nothing to propose (fewer than 2 branches with defined rates, or worst === best).
   */
  static proposeBranchReallocation(
    insights: ReadonlyArray<BranchInsight>,
    fraction = 0.2,
  ): ReadonlyArray<PortfolioFinding> {
    const withRate = insights.filter((i) => i.avgRphChatIDR !== null);
    if (withRate.length < 2) {
      return [];
    }
    // `withRate` is already filtered to entries with a non-null `avgRphChatIDR` — asserted, not defaulted.
    const sorted = [...withRate].sort(
      (a, b) => (b.avgRphChatIDR as number) - (a.avgRphChatIDR as number),
    );
    const worst = sorted[0];
    const best = sorted[sorted.length - 1];
    if (!worst || !best || worst.branch === best.branch) {
      return [];
    }
    const amountIDR = Math.round(worst.totalSpendIDR * fraction);
    if (amountIDR <= 0) {
      return [];
    }
    return [
      {
        key: `realloc:${worst.branch}->${best.branch}`,
        type: "REALLOCATE_BUDGET",
        description: `Realokasi dari ${worst.branch} ke ${best.branch}`,
        reallocationAmountIDR: amountIDR,
        fromLabel: worst.branch,
        toLabel: best.branch,
      },
    ];
  }
}
