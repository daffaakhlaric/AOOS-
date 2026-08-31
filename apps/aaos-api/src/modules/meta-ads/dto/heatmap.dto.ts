import type { AudienceLabel } from "@aos/meta-ads-connector";

/**
 * `GET /api/v1/analytics/heatmap` response shapes (AAOS Analytics Platform Phase 3, "Audience ×
 * Creative Heatmap"). Reuses this same module's `AssetRollupItemDto` conventions exactly (additive
 * fields summed, `maxFrequency` non-additive/MAX, `cpl` recomputed via `Rph.calculate` from the
 * cell's own summed spend/totalLead — see `asset-rollup.ts`'s docstring) — just grouped by BOTH
 * creative asset AND the real `AdSet.audienceLabel` (AAOS Analytics Platform Phase 3's own
 * `classifyAudience` wiring, `@aos/meta-ads-connector`) instead of asset alone.
 */

export type HeatmapAssetKind = "IMAGE" | "VIDEO";

export interface HeatmapCellDto {
  readonly assetKind: HeatmapAssetKind;
  /** The real `image_hash` (IMAGE) or `video_id` (VIDEO) Meta creative identifier — same real id `AssetRollupItemDto.assetId` uses. */
  readonly assetId: string;
  readonly audienceLabel: AudienceLabel;
  /** Count of real ads sharing this exact (creative asset, audience label) pair. */
  readonly adCount: number;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly totalLead: number;
  /** NOT additive — same real, cited MAX-not-average convention as `AssetRollupItemDto.maxFrequency`. */
  readonly maxFrequency: number;
  /** `clicks / impressions`. `null` when impressions is 0 — never a divide-by-zero fabrication. */
  readonly ctr: number | null;
  /** `spend / impressions * 1000` (real, standard CPM definition). `null` when impressions is 0. */
  readonly cpm: number | null;
  /** `spend / totalLead`, RECOMPUTED from this cell's own real summed spend/totalLead — same `Rph.calculate` division-safe convention `AssetRollupItemDto.rphLead` already uses (restated as `cpl` here per the design doc's own "CPL" metric-toggle naming). `null` when totalLead is 0. */
  readonly cpl: number | null;
}

export interface HeatmapResponseDto {
  readonly adAccountId: string;
  readonly generatedAt: string;
  readonly cells: readonly HeatmapCellDto[];
  /** Distinct creative asset ids present in `cells`, highest-total-spend-first (same "most-consequential-first" ordering `asset-rollup.ts`'s own `assets` array already uses) — the heatmap grid's real column order. */
  readonly creativeAssetIds: readonly string[];
  /** Distinct `AudienceLabel`s present in `cells`, in `classifyAudience`'s own real bucket-priority order (BROAD/INTEREST/LOOKALIKE_1/RETARGETING/CUSTOM_CRM) — the heatmap grid's real row order. */
  readonly audienceLabels: readonly AudienceLabel[];
  /**
   * Real, honest count of ads excluded from `cells` — no `creativeAsset` (Meta's `creative`
   * expansion returned neither `image_hash` nor `video_id`, same real gap `AssetRollupResponseDto
   * .untaggedAdCount` already documents) OR the ad's parent `AdSet` carries no `audienceLabel`
   * (should not happen post-Phase-3 wiring — `classifyAudience` always returns a label, even
   * `"BROAD"`, for an ad set with no targeting at all — kept as a real, honest safety net rather
   * than assuming the invariant always holds).
   */
  readonly untaggedAdCount: number;
  /**
   * Portfolio-wide average CPL across every real, currently-pulled ad with a computable `rphLead`
   * — the EXACT same real, cited "tenant's own portfolio average" convention
   * `apps/aaos-dashboard/src/components/meta-ads/CampaignTable.tsx`'s own
   * `computePortfolioAvgCplIDR` already establishes for Phase 1 (arithmetic mean of each ad's own
   * `rphLead`, not a single ratio of pooled sums) — restated here server-side since this endpoint
   * already holds the full real `AdAccount` tree Phase 1's client-side proxy needed to reconstruct
   * from scratch. `null` when no ad in the pull has a computable `rphLead`.
   */
  readonly benchmarkCplIDR: number | null;
  /** Deterministic, template-based summary (`generateHeatmapInsight`) — NEVER an LLM call, per the design doc's explicit instruction that this specific insight stays pure (contrast with Phase 4's real Samantha/LLM insight). */
  readonly insightText: string;
}
