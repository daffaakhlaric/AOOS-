import type { CampaignHealth } from "../../campaign-health/domain/campaign-health.js";
import type { SamanthaDecision } from "../../campaign-health/domain/decision.js";
import type { CampaignDiagnosis } from "../../campaign-health/domain/diagnosis.js";
import type { Opportunity } from "../../opportunities/domain/opportunity.js";

/**
 * `GET /api/v1/command-center/account-summary` response — EYVRA Samantha V2 Command Center
 * real-data-wiring fix. One real per-campaign `{health, diagnosis, decision}` (the SAME
 * `CampaignHealthResponseDto` shape `CampaignHealthService.assess` already returns per campaign,
 * echoed here for EVERY real active campaign instead of requiring N client round trips), plus
 * `campaignName`/`spend` (real Meta fields, so the frontend can render/sort/compute a real
 * spend-at-risk number without a second lookup back into `OverviewCampaignsSummaryDto`).
 *
 * `campaignId` here is the real Meta campaign id (`Campaign.metaId`) — the SAME id
 * `CampaignHealthService.assess`/`MetricSnapshotService.getCampaignSnapshot` require, NOT
 * `Campaign.id` (an internal, randomly-generated `CampaignId` UUID with no real Meta meaning —
 * verified by direct read of `CampaignMapper.ts`/`CampaignId.generate()`). The pre-existing
 * Command Center frontend called `/api/campaign-health/:campaignId` with `Campaign.id` instead of
 * `Campaign.metaId` — a real, separate latent bug this new aggregate does NOT repeat.
 */
/**
 * AAOS Command Center creative thumbnails — the ONE real Meta creative that represents a campaign
 * row, picked by `domain/representative-creative.ts`'s pure `selectRepresentativeCreative` over the
 * real Campaign -> Ad Set -> Ad -> Meta creative lineage the campaign pull already returns.
 *
 * Every field traces to a real Meta/DB value, and every one that could not be established is
 * OMITTED rather than filled in:
 *  - `thumbnailUrl` — the real Meta image `url`/`permalink_url` or video poster-frame URI, resolved
 *    via `ResolveCreativeThumbnails`. Absent when Meta did not resolve the ref (deleted asset,
 *    video still processing, rate-limited moment); the row then falls back to its own listing photo
 *    and finally to its honest placeholder.
 *  - `kind`/`metaCreativeRef` — real `meta_ads.creative_kind` / `creative_ref` (a HASH for IMAGE, a
 *    VIDEO ID for VIDEO). Always present, since a selection cannot exist without one.
 *  - `badge` — see `representative-creative.ts`'s `deriveBadge` for the exact real-field mapping.
 *    Absent means the selected creative's real verdict is genuinely neither winning nor fatigued.
 *  - `kaiCreativePackageId`/`assetUrl` — real Kai lineage, present ONLY when this exact
 *    `metaAdId` appears in some `creative_packages.published_meta_ad_ids` row (migration `052`).
 *    NOTE the honest limit documented on `CommandCenterService`: no persisted mapping exists from a
 *    Meta creative HASH/VIDEO ID back to a Kai package, so lineage is resolved by AD id.
 *    Deliberately NOT named `kaiConceptId` — no such column/field exists anywhere in this codebase;
 *    `creative_packages.id` is the real identity of a Kai creative.
 */
export interface RepresentativeCreativeDto {
  readonly thumbnailUrl?: string;
  readonly kind: "IMAGE" | "VIDEO";
  readonly badge?: "WINNER" | "FATIGUED";
  /** Real Meta ad id (`Ad.metaId`) of the ad whose creative was selected. */
  readonly metaAdId: string;
  /** The real Meta image hash / video id — the same value `meta_ads.creative_ref` stores. */
  readonly metaCreativeRef: string;
  /** Which of the 4 real priority tiers decided this pick (1 = active winner ... 4 = most recently active). */
  readonly priorityTier: 1 | 2 | 3 | 4;
  /** Real `creative_packages.id` — present only when a real published-ad link exists. */
  readonly kaiCreativePackageId?: string;
  /** Real Kai-side generated asset URL (GCS) from that package — `video_url`, else the first `image_urls` entry. */
  readonly assetUrl?: string;
}

/**
 * Which real metric a row's mini sparkline series is measured in. Deliberately limited to the 3
 * real `meta_insights_daily` columns this codebase's own `SamanthaSignalType` root causes are
 * actually ABOUT (`ctr`/`cpl`/`frequency`) — a root cause with no such metric (e.g.
 * `SPEND_WITHOUT_RESULT`, `INSUFFICIENT_DATA`) gets NO trend rather than a guessed one.
 */
export type CampaignTrendMetric = "ctr" | "cpl" | "frequency";

/**
 * Samantha Attention Queue row mini sparkline — a real, per-campaign daily series read from
 * `meta_insights_daily` (`level = 'campaign'`, oldest-to-newest) via the already-live
 * `MetaSyncRepository.getCampaignDailyHistory` chain. A plain Postgres read: it costs ZERO Meta Ads
 * API calls, so it cannot contribute to the real 200-calls/hour budget exhaustion documented on
 * `CommandCenterService`.
 *
 * `metric` is chosen from the campaign's OWN real `diagnosis.rootCause`, so the sparkline shows the
 * metric the diagnosis is actually about — never an arbitrary default.
 *
 * `points` are the real per-day values for that metric, in date order, with non-finite rows
 * dropped. The whole `trend` field is OMITTED (never emitted as a flat/padded series) whenever the
 * campaign has fewer than 2 real days, its root cause maps to no metric, or the history read
 * failed.
 */
export interface CampaignTrendDto {
  readonly metric: CampaignTrendMetric;
  /** Real daily values, oldest-to-newest. Always at least 2 entries when present. */
  readonly points: readonly number[];
}

export interface CampaignHealthSummaryEntryDto {
  readonly campaignId: string;
  readonly campaignName: string;
  /** Real Meta campaign spend over this endpoint's own campaign-enumeration window (see `ACCOUNT_SUMMARY_DATE_PRESET`) — NOT the same window `health`/`diagnosis`/`decision` were computed over (those always use `CampaignHealthService`'s own fixed `last_7_days`/`previous_7_days`/`lifetime` windows), so this is an honest "current recent spend" figure for display, never assumed to be the exact spend backing the health assessment above it. */
  readonly spend: number;
  readonly health: CampaignHealth;
  readonly diagnosis: CampaignDiagnosis;
  readonly decision: SamanthaDecision;
  /**
   * AAOS Command Center creative thumbnails — additive/optional. Absent when NO ad under this
   * campaign carries a real Meta creative ref at all (the honest "nothing to show" state), which
   * lets the frontend fall through to its listing photo and then its placeholder.
   */
  readonly representativeCreative?: RepresentativeCreativeDto;
  /**
   * Samantha Attention Queue row mini sparkline — additive/optional real daily series. See
   * `CampaignTrendDto` for the exact real source, the metric-selection rule, and every reason this
   * is honestly absent rather than fabricated.
   */
  readonly trend?: CampaignTrendDto;
}

export interface AccountSummaryResponseDto {
  readonly tenantId: string;
  readonly generatedAt: string;
  /** Real count of campaigns this response actually assessed (after the `MAX_CAMPAIGNS_ANALYZED` cap and after excluding any campaign whose individual `assess()` call failed — see `errors`). */
  readonly campaignsAnalyzed: number;
  /** `true` when this tenant had more real active campaigns than `MAX_CAMPAIGNS_ANALYZED` — an honest signal the frontend can use to say "top N of M", never silently hidden. */
  readonly campaignsCapped: boolean;
  readonly campaigns: readonly CampaignHealthSummaryEntryDto[];
  /** Every real `Opportunity` this account has today — `SCALING_OPPORTUNITY` (one per analyzed campaign whose real `decision` qualifies) + `CREATIVE_WINNER_EXPANSION` (one per real rank-1 angle, account-wide, independent of which campaigns were analyzed). */
  readonly opportunities: readonly Opportunity[];
  /** Real, honest partial-failure reasons — `"campaigns"` for a failed campaign-enumeration pull, `"creativeMemory"` for a failed angle-performance read, `campaignHealth:<campaignId>` for one campaign's failed `assess()` call. Same discipline `OverviewResponseDto.errors` already establishes: a failure here never aborts the rest of the response. */
  readonly errors: Readonly<Record<string, string>>;
}
