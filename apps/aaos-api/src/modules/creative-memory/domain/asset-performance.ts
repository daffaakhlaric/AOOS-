import {
  aggregateInsightRows,
  type AggregatedMetrics,
} from "../../metric-snapshot/domain/aggregate-insights.js";
import {
  assessDataSufficiency,
  type DataSufficiencyResult,
} from "../../metric-snapshot/domain/data-sufficiency.js";
import type { InsightRow } from "../../metric-snapshot/infrastructure/metric-snapshot.repository.js";

import { compareRankableByCpl, isRankable } from "./angle-performance.js";

/**
 * EYVRA — SAMANTHA V2 + KAI V2 Phase 21 (Kai V2 Asset Analyzer). Pure ranking over the SAME real,
 * already-persisted `creative_packages.published_meta_ad_ids` -> `meta_ads` -> `meta_insights_daily`
 * join `creative-memory/domain/angle-performance.ts` (Phase 2) already established — no I/O, no new
 * data source.
 *
 * WHY THIS EXISTS ALONGSIDE `angle-performance.ts`, NOT INSTEAD OF IT: `rankAnglePerformance` groups
 * every published package under its shared `angle` before ranking — it can tell a manager "angle
 * URGENCY performs best" but not "which SPECIFIC generated asset (this exact video, these exact 3
 * images, this exact copy) is the one actually winning". A tenant with `packageCount: 3` under one
 * winning angle still has no way to know whether all 3 real assets perform similarly or one is
 * carrying the angle's whole result. This module answers exactly that — one `AssetPerformanceResult`
 * per real, individually-published `creative_packages` row, never grouped.
 *
 * HONEST SCOPE — read before assuming this analyzes pixels/video content: there is no vision-model
 * call, no image/video content analysis, and no LLM anywhere in this file. "Asset Analyzer" here
 * means exactly what this codebase can honestly support today: ranking each individually-published
 * creative asset by its OWN real historical ad performance (CPL, CTR, spend, leads), the same
 * discipline `angle-performance.ts`'s own real CPL ranking already established, extended from
 * "grouped by angle" to "one real row per asset". A future phase with a real vision/content-analysis
 * pipeline could add genuine visual scoring on top of this — nothing here fabricates that in the
 * meantime.
 */
export interface AssetPerformanceInput {
  readonly packageId: string;
  readonly angle: string;
  readonly title: string;
  /** Kai's real decided format (`VIDEO_AND_IMAGES` | `IMAGES_ONLY`) — `undefined` for a pre-Sprint-6 row this column predates, or a row generation never actually completed for. */
  readonly decidedFormat?: string;
  readonly fatigueStatus: string;
  readonly hasVideo: boolean;
  readonly imageCount: number;
  /** This ONE asset's own linked Meta ads' real daily rows (every `meta_ad_id` in its `published_meta_ad_ids`, flattened). */
  readonly insightRows: readonly InsightRow[];
}

export interface AssetPerformanceResult {
  readonly packageId: string;
  readonly angle: string;
  readonly title: string;
  readonly decidedFormat?: string;
  readonly fatigueStatus: string;
  readonly hasVideo: boolean;
  readonly imageCount: number;
  readonly aggregated: AggregatedMetrics;
  readonly dataSufficiency: DataSufficiencyResult;
  /**
   * `1` = best real CPL among assets with `dataSufficiency.level >= "MEDIUM"`. `undefined` for any
   * asset below that bar — an asset with too little data is reported (never hidden) but never
   * force-ranked against a reliable one. Same rule `angle-performance.ts`'s own `rank` establishes,
   * at asset granularity.
   */
  readonly rank?: number;
}

/**
 * Ranks each REAL, individually-published creative asset (one `creative_packages` row) by its own
 * real CPL — never grouped by angle (that is `rankAnglePerformance`'s job). Reuses
 * `compareRankableByCpl`/`isRankable` verbatim from `angle-performance.ts` — SAME zero-lead
 * tie-break rule (a real asset with real spend and zero leads is placed LAST among the rankable set,
 * never first/omitted), SAME `dataSufficiency.level >= "MEDIUM"` rankable bar, applied here per-asset
 * instead of per-angle-group.
 *
 * Returns `[]` — a real, honest empty result, never fabricated — for empty input.
 */
export function rankAssetPerformance(
  assets: readonly AssetPerformanceInput[],
): readonly AssetPerformanceResult[] {
  const results: AssetPerformanceResult[] = assets.map((asset) => {
    const aggregated = aggregateInsightRows(asset.insightRows);
    const sampleSize = {
      impressions: aggregated.impressions,
      clicks: aggregated.clicks,
      leads: aggregated.leads,
    };
    const daysCovered = new Set(asset.insightRows.map((row) => row.date)).size;
    const dataSufficiency = assessDataSufficiency(sampleSize, daysCovered);
    return {
      packageId: asset.packageId,
      angle: asset.angle,
      title: asset.title,
      ...(asset.decidedFormat !== undefined ? { decidedFormat: asset.decidedFormat } : {}),
      fatigueStatus: asset.fatigueStatus,
      hasVideo: asset.hasVideo,
      imageCount: asset.imageCount,
      aggregated,
      dataSufficiency,
    };
  });

  const rankable = results.filter((result) => isRankable(result.dataSufficiency.level));
  const sortedRankable = [...rankable].sort(compareRankableByCpl);
  const rankByPackageId = new Map<string, number>();
  sortedRankable.forEach((result, index) => {
    rankByPackageId.set(result.packageId, index + 1);
  });

  // Ranked assets first (in real rank order), then unranked ones (insufficient data), each keeping
  // its original input order relative to its own peers — never silently dropped.
  const ranked = sortedRankable.map((result) => ({
    ...result,
    rank: rankByPackageId.get(result.packageId),
  }));
  const unranked = results.filter((result) => !rankByPackageId.has(result.packageId));
  return [...ranked, ...unranked];
}
