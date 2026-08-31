import type { AudienceLabel } from "@aos/meta-ads-connector";

import type { AssetInsightResponseDto } from "../../llm/dto/asset-insight.dto.js";

import type { AssetKind } from "./asset-rollup.dto.js";

/**
 * `GET /api/v1/analytics/assets/:assetId` response shape (AAOS Analytics Platform Phase 4,
 * "Asset detail / Creative Drill-Down"). Consumes the same real pulled `AdAccount` tree
 * `asset-rollup.ts`/`heatmap-rollup.ts` already read, filtered down to just the ads sharing ONE
 * real creative asset id, then broken down two ways per the design doc:
 *
 * - `copyVariants`: one row per real ad carrying this asset. Real, honest finding (confirmed via
 *   direct read of `MetaApiRequestBuilder.AD_FIELDS`/`MetaApiTypes.MetaAdSchema`/`Ad.ts`): this
 *   codebase pulls NO real creative headline/body text for an ad — only `id`/`name`/`status`/
 *   `created_time`/`creative{image_hash,video_id}`. There is no real "copy" field to show. Rather
 *   than fabricate headline/body text that was never pulled from Meta, this reuses the ad's own
 *   real `name` as the copy-variant label — the EXACT same honest precedent
 *   `SamanthaRecommendations.tsx` already documents ("the ad name is the only unit signal
 *   Samantha's snapshot carries").
 * - `audienceBreakdown`: this asset's own ads grouped by their real parent `AdSet.audienceLabel`
 *   (Phase 3's real `classifyAudience` wiring) — same additive-sum/MAX-frequency/`Rph.calculate`
 *   conventions `heatmap-rollup.ts` already establishes, just scoped to one asset instead of the
 *   whole grid.
 */
export interface AssetDetailCopyVariantDto {
  /** Real Meta ad id (`Ad.metaId`). */
  readonly adId: string;
  /** Real internal `#C...` stable id (`Ad.stableId`). */
  readonly stableId: string;
  /** The ad's real `name` — reused as the copy-variant label (see this file's own docstring). */
  readonly name: string;
  readonly branch: string;
  readonly audienceLabel: AudienceLabel | undefined;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly totalLead: number;
  /** This one ad's own real frequency — not a bucket MAX (there is nothing to bucket at this granularity). */
  readonly frequency: number;
  /** This one ad's own real `rphLead` (`Ad.metrics.rphLead.value`) — never recomputed from a sum. */
  readonly cpl: number | null;
}

export interface AssetDetailAudienceBreakdownDto {
  readonly audienceLabel: AudienceLabel;
  readonly adCount: number;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly totalLead: number;
  /** NOT additive — same real, cited MAX-not-average convention `HeatmapCellDto.maxFrequency` uses. */
  readonly maxFrequency: number;
  /** `spend / totalLead`, recomputed from this bucket's own summed spend/totalLead via `Rph.calculate` — same division-safe convention every other rollup in this module uses. */
  readonly cpl: number | null;
}

export interface AssetDetailResponseDto {
  readonly adAccountId: string;
  readonly generatedAt: string;
  readonly assetKind: AssetKind;
  readonly assetId: string;
  /** Additive across every real ad carrying this asset — same convention as `AssetRollupItemDto`. */
  readonly adCount: number;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly totalLead: number;
  readonly maxFrequency: number;
  readonly rphLead: number | null;
  readonly copyVariants: readonly AssetDetailCopyVariantDto[];
  readonly audienceBreakdown: readonly AssetDetailAudienceBreakdownDto[];
  /**
   * The `audienceBreakdown` entry with the lowest real CPL among buckets that have at least one
   * real lead; falls back to the highest-spend bucket when no bucket has a lead yet; `undefined`
   * only when `audienceBreakdown` itself is empty. Powers both the drill-down page's own
   * highlighted row and the "Brief ke Kai" button's real pre-fill (design doc: "its top-performing
   * audience label").
   */
  readonly topAudienceLabel: AudienceLabel | undefined;
  /** Real Samantha LLM-generated insight for this one asset (design doc: this one DOES call an LLM, unlike Phase 3's deterministic heatmap insight). */
  readonly insight: AssetInsightResponseDto;
}
