import { err, ok, type Result } from "@aos/common";
import type { Ad, AdAccount } from "@aos/meta-ads-connector";
import { Verdict } from "@aos/meta-ads-connector";

import { calculateAverageRphD3 } from "../../calculators/BackwardPlanningCalculator.js";
import type { Objective } from "../../domain/entities/Objective.js";
import type { ObjectiveProgress } from "../../domain/entities/ObjectiveProgress.js";
import { TamaraRecommendation } from "../../domain/entities/TamaraRecommendation.js";
import { InvalidObjectiveError, type ObjectiveError } from "../../domain/errors/index.js";
import { EstimatedImpact } from "../../domain/value-objects/EstimatedImpact.js";
import {
  RecommendedAction,
  type RecommendedActionInput,
} from "../../domain/value-objects/RecommendedAction.js";
import { formatIDR } from "../../utils/BudgetUtils.js";

export interface RecommendationInput {
  readonly objective: Objective;
  readonly progress: ObjectiveProgress | undefined;
  readonly adAccount: AdAccount;
  readonly now: Date;
}

const SCALE_THRESHOLD_FACTOR = 0.7; // "at least 30% cheaper than average"
const PAUSE_THRESHOLD_FACTOR = 2.0; // "at least 2x more expensive than average"

/**
 * Implements the Tamara Recommendation Generation algorithm (spec steps 1-8), used by the
 * `GenerateRecommendation` use case. Exported publicly (spec index.ts) so a caller can also
 * invoke it directly for testing/composition without going through the full use case.
 */
export class RecommendationService {
  generate(input: RecommendationInput): Result<TamaraRecommendation, ObjectiveError> {
    const ads = flattenAds(input.adAccount);
    const avgRphD3 = calculateAverageRphD3(input.adAccount);

    // Step 2/3: verdict AND relative-to-average threshold (AND-condition, not OR) — an ad must
    // satisfy BOTH its meta-ads-connector-computed verdict AND the Rp/D3-vs-average threshold.
    const pauseCandidates = ads
      .filter(
        (ad) =>
          ad.verdict === Verdict.PAUSE &&
          avgRphD3 > 0 &&
          ad.metrics.rphD3.isDefined() &&
          (ad.metrics.rphD3.value as number) > avgRphD3 * PAUSE_THRESHOLD_FACTOR,
      )
      .sort((a, b) => (b.metrics.rphD3.value ?? 0) - (a.metrics.rphD3.value ?? 0)); // most expensive first

    const scaleCandidates = ads
      .filter(
        (ad) =>
          ad.verdict === Verdict.SCALE &&
          avgRphD3 > 0 &&
          ad.metrics.rphD3.isDefined() &&
          (ad.metrics.rphD3.value as number) < avgRphD3 * SCALE_THRESHOLD_FACTOR,
      )
      .sort((a, b) => (a.metrics.rphD3.value ?? 0) - (b.metrics.rphD3.value ?? 0)); // cheapest first

    const fixCandidates = ads.filter((ad) => ad.verdict === Verdict.FIX);
    const refreshCandidates = ads.filter((ad) => ad.verdict === Verdict.REFRESH);

    // Step 4: budget freed from PAUSE — each paused ad's current period spend is the proxy for
    // the budget it would stop consuming (this package has no separate Ad-level budget field;
    // only aggregate `AdSet.dailyBudget` and per-ad `AdMetrics.spend` exist upstream).
    const freedBudget = pauseCandidates.reduce((sum, ad) => sum + ad.metrics.spend.toNumber(), 0);
    // Step 5: allocate freed budget evenly across SCALE candidates (documented judgment call —
    // the spec does not pin a specific allocation weighting).
    const perScaleBudget = scaleCandidates.length > 0 ? freedBudget / scaleCandidates.length : 0;

    const actionInputs: RecommendedActionInput[] = [];

    for (const ad of pauseCandidates) {
      const rphD3 = ad.metrics.rphD3.value as number;
      actionInputs.push({
        type: "PAUSE",
        targetId: ad.id.toString(),
        targetType: "ad",
        targetName: adTargetName(ad),
        reason: `Rp/D3 ${formatIDR(rphD3)} lebih dari ${PAUSE_THRESHOLD_FACTOR}x rata-rata (${formatIDR(avgRphD3)}) — verdict PAUSE dari meta-ads-connector`,
        estimatedBudgetSaving: ad.metrics.spend.toNumber(),
        priority: 1,
      });
    }

    for (const ad of scaleCandidates) {
      const rphD3 = ad.metrics.rphD3.value as number;
      const estimatedLeadGain = rphD3 > 0 ? Math.floor(perScaleBudget / rphD3) : 0;
      actionInputs.push({
        type: "SCALE",
        targetId: ad.id.toString(),
        targetType: "ad",
        targetName: adTargetName(ad),
        reason: `Rp/D3 ${formatIDR(rphD3)} lebih murah dari ${Math.round((1 - SCALE_THRESHOLD_FACTOR) * 100)}% rata-rata (${formatIDR(avgRphD3)}) — verdict SCALE dari meta-ads-connector`,
        estimatedLeadGain,
        priority: 2,
      });
    }

    for (const ad of fixCandidates) {
      actionInputs.push({
        type: "FIX",
        targetId: ad.id.toString(),
        targetType: "ad",
        targetName: adTargetName(ad),
        // AAOS-W1D-S3: names the actual fix target — DSS Motor's real strategy objective
        // (OUTCOME_LEADS + CTWA straight to WhatsApp), not just "needs fixing" in the abstract.
        // Note: this file lives in @aos/objective-engine (not @aos/meta-ads-agent, where the
        // W1D-S3 spec's "Update TamaraRecommendation — FIX action" section assumed it would be) —
        // it's the real, current location of "GenerateRecommendation's FIX action output".
        reason:
          "Verdict FIX dari meta-ads-connector — objective perlu diganti ke OUTCOME_LEADS + CTWA (lead langsung ke WhatsApp)",
        priority: 3,
      });
    }

    for (const ad of refreshCandidates) {
      actionInputs.push({
        type: "REFRESH",
        targetId: ad.id.toString(),
        targetType: "ad",
        targetName: adTargetName(ad),
        reason:
          "Verdict REFRESH dari meta-ads-connector — frequency tinggi, kreatif perlu di-refresh",
        priority: 3,
      });
    }

    const actions: RecommendedAction[] = [];
    for (const actionInput of actionInputs) {
      const result = RecommendedAction.create(actionInput);
      /* v8 ignore next 3 */
      if (!result.ok) {
        return err(new InvalidObjectiveError(result.error.message));
      }
      actions.push(result.value);
    }

    const additionalLeadsEstimate = scaleCandidates.reduce((sum, ad) => {
      const rphD3 = ad.metrics.rphD3.value as number;
      return sum + (rphD3 > 0 ? Math.floor(perScaleBudget / rphD3) : 0);
    }, 0);
    const budgetSavingEstimate = freedBudget;

    const currentHotLeads = input.progress?.currentHotLeads ?? 0;
    const targetHotLeads = input.objective.targetHotLeads.toNumber();
    const remainingGap = Math.max(0, targetHotLeads - currentHotLeads);
    const targetGapClosedPercentage =
      remainingGap === 0 ? 100 : Math.min(100, (additionalLeadsEstimate / remainingGap) * 100);

    const estimatedImpactResult = EstimatedImpact.create({
      additionalLeadsEstimate,
      budgetSavingEstimate,
      targetGapClosedPercentage,
    });
    /* v8 ignore next 3 */
    if (!estimatedImpactResult.ok) {
      return err(new InvalidObjectiveError(estimatedImpactResult.error.message));
    }

    const confidence =
      ads.length === 0 ? 0 : Math.round((definedRphD3Count(ads) / ads.length) * 100);

    const summary = buildSummary({
      pauseCount: pauseCandidates.length,
      scaleCount: scaleCandidates.length,
      fixCount: fixCandidates.length,
      refreshCount: refreshCandidates.length,
      freedBudget,
      additionalLeadsEstimate,
    });

    const recommendationResult = TamaraRecommendation.create({
      objectiveId: input.objective.id,
      generatedAt: input.now,
      summary,
      actions,
      estimatedImpact: estimatedImpactResult.value,
      confidence,
    });
    /* v8 ignore next 3 */
    if (!recommendationResult.ok) {
      return err(new InvalidObjectiveError(recommendationResult.error.message));
    }

    return ok(recommendationResult.value);
  }
}

function flattenAds(adAccount: AdAccount): ReadonlyArray<Ad> {
  const ads: Ad[] = [];
  for (const campaign of adAccount.campaigns) {
    for (const adSet of campaign.adSets) {
      for (const ad of adSet.ads) {
        ads.push(ad);
      }
    }
  }
  return ads;
}

function definedRphD3Count(ads: ReadonlyArray<Ad>): number {
  return ads.filter((ad) => ad.metrics.rphD3.isDefined()).length;
}

function adTargetName(ad: Ad): string {
  return `${ad.stableId.toString()} ${ad.name}`;
}

interface SummaryInput {
  readonly pauseCount: number;
  readonly scaleCount: number;
  readonly fixCount: number;
  readonly refreshCount: number;
  readonly freedBudget: number;
  readonly additionalLeadsEstimate: number;
}

/** Step 8: generate a real, business-appropriate Bahasa Indonesia narrative from the actual computed actions/impact — never a hardcoded string. */
function buildSummary(input: SummaryInput): string {
  const parts: string[] = [];
  if (input.pauseCount > 0) {
    parts.push(`menjeda ${input.pauseCount} iklan dengan performa rendah`);
  }
  if (input.scaleCount > 0) {
    parts.push(
      `mengalokasikan ${formatIDR(input.freedBudget)} ke ${input.scaleCount} iklan terbaik`,
    );
  }
  if (input.fixCount > 0) {
    parts.push(`memperbaiki ${input.fixCount} iklan yang perlu di-fix`);
  }
  if (input.refreshCount > 0) {
    parts.push(`me-refresh kreatif ${input.refreshCount} iklan`);
  }

  if (parts.length === 0) {
    return "Tamara tidak menemukan tindakan yang perlu diambil saat ini — seluruh iklan berada dalam performa yang stabil.";
  }

  return `Tamara merekomendasikan ${parts.join(", ")}. Estimasi tambahan ${input.additionalLeadsEstimate} hot leads.`;
}
