import type { BranchId } from "@aos/branch-manager";

import type { BranchPerformance } from "../../domain/entities/BranchPerformance.js";
import type { ClosingVerdict } from "../../domain/entities/CampaignAttribution.js";
import type { ClosingReport } from "../../domain/entities/ClosingReport.js";
import type { ReportPeriod } from "../../domain/value-objects/ReportPeriod.js";

export type BudgetRecommendation = "INCREASE_BUDGET" | "MAINTAIN" | "DECREASE_BUDGET";

export interface SamanthaCampaignSignal {
  readonly campaignId: string;
  readonly rphSpk: number;
  readonly closingRate: number;
  readonly totalSpk: number;
  readonly verdict: ClosingVerdict;
  readonly confidence: number;
}

export interface SamanthaBranchSignal {
  readonly branch: BranchId;
  readonly closingRate: number;
  readonly avgRphSpk: number;
  readonly recommendation: BudgetRecommendation;
}

export interface SamanthaObjectiveStatus {
  readonly targetSpk: number;
  readonly achievedSpk: number;
  readonly completionRate: number;
  readonly onTrack: boolean;
}

/** Output of `FeedToSamantha` — consumed by `@aos/meta-ads-agent` (spec: "Samantha Feed Format"). */
export interface SamanthaFeedData {
  readonly period: ReportPeriod;
  readonly campaignSignals: ReadonlyArray<SamanthaCampaignSignal>;
  readonly branchSignals: ReadonlyArray<SamanthaBranchSignal>;
  readonly objectiveStatus: SamanthaObjectiveStatus;
}

/** `BranchPerformance.closingRate` thresholds for the branch-level budget recommendation — a judgment call (unspecced), pinned by the spec's own example: "branch Cinere closing rate 0.35 → INCREASE_BUDGET". `>= 0.30` scales up, `< 0.15` scales down, the 0.15-0.30 band holds steady. */
const INCREASE_BUDGET_THRESHOLD = 0.3;
const DECREASE_BUDGET_THRESHOLD = 0.15;

/** Formats aggregated closing/attribution data for Samantha (`@aos/meta-ads-agent`) consumption (spec: "SamanthaFeedService"). A pure transform over an already-generated `ClosingReport` — does not re-aggregate. */
export class SamanthaFeedService {
  build(report: ClosingReport, targetSpk: number): SamanthaFeedData {
    const campaignSignals: SamanthaCampaignSignal[] = report.campaignAttributions.map((a) => ({
      campaignId: a.campaignId,
      rphSpk: a.rphSpk.value,
      closingRate: a.closingRate.value,
      totalSpk: a.totalSpk,
      verdict: a.verdict,
      confidence: a.attributionScore.value,
    }));

    const branchSignals: SamanthaBranchSignal[] = report.byBranch.map((b) => ({
      branch: b.branch,
      closingRate: b.closingRate.value,
      avgRphSpk: b.avgRphSpk.value,
      recommendation: this.recommendationFor(b),
    }));

    const achievedSpk = report.totalSpk;
    const completionRate = targetSpk > 0 ? achievedSpk / targetSpk : 0;

    return {
      period: report.period,
      campaignSignals,
      branchSignals,
      objectiveStatus: {
        targetSpk,
        achievedSpk,
        completionRate,
        /** Judgment call: strictly "target already reached this period" — this package has no
         * day-elapsed pacing data (that's `@aos/objective-engine`'s `ObjectiveProgress` concern)
         * to compute a true pace-based on-track boolean. */
        onTrack: achievedSpk >= targetSpk,
      },
    };
  }

  private recommendationFor(branch: BranchPerformance): BudgetRecommendation {
    if (branch.closingRate.value >= INCREASE_BUDGET_THRESHOLD) {
      return "INCREASE_BUDGET";
    }
    if (branch.closingRate.value < DECREASE_BUDGET_THRESHOLD) {
      return "DECREASE_BUDGET";
    }
    return "MAINTAIN";
  }
}
