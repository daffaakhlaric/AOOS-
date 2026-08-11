import { err, ok, type Result } from "@aos/common";
import type { Ad, AdAccount } from "@aos/meta-ads-connector";
import { Verdict } from "@aos/meta-ads-connector";

import type {
  ICampaignOptimizer,
  OptimizationPipelineResult,
} from "../contracts/ICampaignOptimizer.js";
import { DecisionError } from "../domain/errors/index.js";
import type { PerAdFinding } from "../types/AgentTypes.js";

import { AudienceInsightEngine } from "./AudienceInsightEngine.js";
import { BudgetOptimizer } from "./BudgetOptimizer.js";

/** SCALE budget increase — mirrors `@aos/meta-ads-connector`'s `Budget.scaleBy` convention of a +20% step per SCALE verdict. */
const SCALE_INCREASE_FACTOR = 0.2;

/**
 * Orchestrates the full ANALYZE stage: flattens the `AdAccount` hierarchy into per-ad findings,
 * computes the account-wide average Rp/chat (used by `VerdictDecisionEngine`'s PAUSE thresholds),
 * computes data coverage (fraction of ads with a defined `rphD3`, feeding `ConfidenceScore`), and
 * proposes portfolio-level findings via `BudgetOptimizer`/`AudienceInsightEngine`.
 */
export class OptimizationPipeline implements ICampaignOptimizer {
  analyze(adAccount: AdAccount): Result<OptimizationPipelineResult, DecisionError> {
    const ads: Ad[] = [];
    const budgetByAdSetId = new Map<string, number>();
    for (const campaign of adAccount.campaigns) {
      for (const adSet of campaign.adSets) {
        budgetByAdSetId.set(adSet.id.toString(), adSet.dailyBudget.toNumber());
        for (const ad of adSet.ads) {
          ads.push(ad);
        }
      }
    }

    if (ads.length === 0) {
      return err(
        new DecisionError("OptimizationPipeline.analyze: AdAccount has no ads to analyze"),
      );
    }

    const adFindings: PerAdFinding[] = ads.map((ad) => {
      const currentDailyBudgetIDR = budgetByAdSetId.get(ad.adSetId.toString());
      const budgetIncreaseIDR =
        ad.verdict === Verdict.SCALE && currentDailyBudgetIDR !== undefined
          ? Math.round(currentDailyBudgetIDR * SCALE_INCREASE_FACTOR)
          : undefined;

      let targetId = ad.id.toString();
      let targetType: PerAdFinding["targetType"] = "ad";
      if (ad.verdict === Verdict.SCALE) {
        targetId = ad.adSetId.toString();
        targetType = "adset";
      } else if (ad.verdict === Verdict.FIX) {
        targetId = ad.campaignId.toString();
        targetType = "campaign";
      }

      return {
        adId: ad.id.toString(),
        targetId,
        targetType,
        verdict: ad.verdict,
        branch: ad.branch,
        unit: ad.name,
        spendIDR: ad.metrics.spend.toNumber(),
        conversations: ad.metrics.conversations,
        rphChatIDR: ad.metrics.rphChat.value,
        rphD3IDR: ad.metrics.rphD3.value,
        budgetIncreaseIDR,
        currentDailyBudgetIDR,
      };
    });

    // Both operands below are already filtered to non-null values — asserted, not defaulted.
    const definedRphChat = adFindings.filter((f) => f.rphChatIDR !== null);
    const avgRphChatIDR =
      definedRphChat.length > 0
        ? definedRphChat.reduce((sum, f) => sum + (f.rphChatIDR as number), 0) /
          definedRphChat.length
        : 0;

    // `adFindings.length` is always > 0 here — `analyze` already returned an error above for
    // `ads.length === 0` — but the guard is kept for defensive clarity at this call site.
    const definedRphD3Count = adFindings.filter((f) => f.rphD3IDR !== null).length;
    const dataCoverageFraction = definedRphD3Count / adFindings.length;

    const branchInsights = AudienceInsightEngine.byBranch(adFindings);
    const portfolioFindings = BudgetOptimizer.proposeBranchReallocation(branchInsights);

    return ok({ adFindings, portfolioFindings, avgRphChatIDR, dataCoverageFraction });
  }
}
