/**
 * `GET /api/v1/analytics/assets` response shapes (AAOS Analytics Platform Phase 2, "Asset-First
 * Analytics"). Groups every real ad's `creativeAsset` (see `@aos/meta-ads-connector`'s `Ad.ts` —
 * `image_hash`/`video_id`, newly pulled this phase via `creative{image_hash,video_id}`) across an
 * `AdAccount`'s whole campaign→adset→ad tree, aggregating real spend/impressions/clicks/leads.
 */

export type AssetKind = "IMAGE" | "VIDEO";

export interface AssetRollupItemDto {
  readonly assetKind: AssetKind;
  /** The real `image_hash` (IMAGE) or `video_id` (VIDEO) Meta creative identifier. */
  readonly assetId: string;
  /** Count of real ads sharing this exact creative asset across the whole pulled tree. */
  readonly adCount: number;
  /** Additive across constituent ads — real Meta metric, summed same as any additive rollup in this codebase (see `CampaignTable.tsx`'s own docstring for the additive-vs-recomputed convention this mirrors). */
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly totalLead: number;
  /**
   * NOT additive (same real, cited reason `CampaignTable.tsx`'s own `sumMetrics` docstring
   * gives for campaign/ad-set rows: `frequency = impressions / reach`, and reach does not sum
   * across distinct ads/audiences without double-counting overlapping reached people) — this is
   * the MAX frequency among the constituent ads, the single worst-offending placement of this
   * creative, not a fabricated weighted average.
   */
  readonly maxFrequency: number;
  /** `spend / totalLead`, RECOMPUTED from this row's own real summed spend/totalLead (never summed from per-ad rphLead values) — same `Rph.calculate` division-safe convention every other real Rp/x figure in this codebase uses. `null` when totalLead is 0. */
  readonly rphLead: number | null;
}

export interface AssetRollupResponseDto {
  readonly adAccountId: string;
  readonly generatedAt: string;
  readonly assets: readonly AssetRollupItemDto[];
  /**
   * Real, honest count of ads that had no `creativeAsset` at all (no `image_hash`/`video_id` on
   * Meta's `creative` expansion — e.g. Dynamic Creative/Instant Experience ads, or no creative
   * attached yet) and are therefore NOT represented in `assets` above — never silently dropped
   * without a trace.
   */
  readonly untaggedAdCount: number;
}
