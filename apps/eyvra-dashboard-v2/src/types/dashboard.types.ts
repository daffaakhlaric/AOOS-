/**
 * Client-safe DTO shapes returned by this app's own src/app/api/* proxy routes. Hand-written,
 * deliberately NOT imported from apps/aaos-api's internal dto/*.ts files or apps/eyvra-dashboard's
 * own src/types/dashboard.types.ts (a different, un-cross-imported app) — same "plain hand-written
 * interface" convention that file itself documents. Trimmed to only the fields the Command Center
 * page (this phase's only page) actually reads; every field here mirrors a real aaos-api response
 * field, never invented.
 */

export interface AdMetricsDto {
  readonly impressions?: number;
  readonly spend: number;
  readonly clicks: number;
  readonly frequency: number;
  readonly totalLead: number;
}

export interface AdSummaryDto {
  readonly primaryText?: string;
  readonly headline?: string;
  readonly creativeAsset?: { readonly kind: "IMAGE" | "VIDEO"; readonly ref: string };
  readonly id: string;
  readonly metaId: string;
  readonly stableId: string;
  readonly name: string;
  readonly status: string;
  readonly verdict: string;
  readonly metrics: AdMetricsDto;
}

export interface AdSetSummaryDto {
  readonly id: string;
  readonly metaId: string;
  readonly stableId: string;
  readonly name: string;
  readonly status: string;
  readonly spend: number;
  readonly dailyBudget: number;
  readonly ads: readonly AdSummaryDto[];
}

export interface CampaignSummaryDto {
  readonly id: string;
  readonly metaId: string;
  readonly stableId: string;
  readonly name: string;
  readonly objective: string;
  readonly status: string;
  readonly spend: number;
  readonly dailyBudget: number;
  readonly adSets: readonly AdSetSummaryDto[];
}

export interface OverviewLeadsSummaryDto {
  readonly hot: number;
  readonly warm: number;
  readonly cold: number;
  readonly hotToday: number;
  readonly hotYesterday: number;
  readonly hotDeltaVsYesterday: number;
}

export interface OverviewCampaignsSummaryDto {
  readonly adAccountId: string;
  readonly datePreset: string;
  readonly activeCampaignsCount: number;
  readonly totalCampaignsCount: number;
  readonly totalSpend: number;
  readonly campaigns: readonly CampaignSummaryDto[];
}

export interface OverviewAgentScoreDto {
  readonly agent: "SAMANTHA" | "KAI" | "CLARA";
  readonly todayAverageOverall?: number;
  readonly priorSevenDayAverageOverall?: number;
  readonly delta?: number;
  readonly todaySampleSize: number;
  readonly priorSevenDaySampleSize: number;
  readonly actionsToday: number;
}

export interface OverviewInsightPerAgentDto {
  readonly samantha: string;
  readonly kai: string;
  readonly clara: string;
}

export type OverviewInsightDto =
  | {
      readonly available: true;
      readonly summary: string;
      readonly perAgent: OverviewInsightPerAgentDto;
    }
  | { readonly available: false; readonly reason: string; readonly message: string };

export interface ActivityToolCallDto {
  readonly tool: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly at: string;
}

export interface ActivityDto {
  readonly id: string;
  readonly agent: string;
  readonly actionType: string;
  readonly mode: string;
  readonly status: string;
  readonly reasoning?: string;
  readonly toolCalls: readonly ActivityToolCallDto[];
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly errorMessage?: string;
  readonly createdAt: string;
}

export interface OverviewResponseDto {
  readonly tenantId: string;
  readonly generatedAt: string;
  readonly leads?: OverviewLeadsSummaryDto;
  readonly campaigns?: OverviewCampaignsSummaryDto;
  /** Always exactly 3 entries (SAMANTHA/KAI/CLARA). */
  readonly agentStatus: readonly OverviewAgentScoreDto[];
  readonly activities: readonly ActivityDto[];
  readonly insight: OverviewInsightDto;
  /** Real, honest reason per failed section. */
  readonly errors: Readonly<Record<string, string>>;
}

export interface OverviewTimeseriesPointDto {
  readonly date: string;
  readonly totalSpend: number;
  readonly totalLeads: number;
}

export interface OverviewTimeseriesResponseDto {
  readonly tenantId: string;
  readonly points: readonly OverviewTimeseriesPointDto[];
}

/** Mirrors aaos-api's GrowthObjectiveResponseDto (apps/aaos-api/src/modules/growth-objectives/dto/growth-objective.dto.ts) — kept as `unknown`-leaning structural types for the nested domain-result shapes (`forecast`/`progress`), which this phase only ever reads defensively (see GrowthObjectiveHero.tsx), never assumes a full shape for. */
export const GROWTH_OBJECTIVE_STATUSES = [
  "DRAFT",
  "ANALYZING",
  "PLANNED",
  "ACTIVE",
  "ON_TRACK",
  "AT_RISK",
  "OFF_TRACK",
  "REPLANNING",
  "COMPLETED",
  "PAUSED",
] as const;
export type GrowthObjectiveStatus = (typeof GROWTH_OBJECTIVE_STATUSES)[number];

export interface EstimatedRangeDto {
  readonly low: number;
  readonly high: number;
}

export interface GrowthObjectiveForecastDto {
  readonly reverseFunnel?: {
    readonly requiredDailyLeads?: number;
    readonly requiredDailySpend?: number;
  };
  readonly feasibility?: {
    readonly verdict?: string;
    readonly reasoning?: string;
  };
  readonly achievableHotLeads?: EstimatedRangeDto;
}

export interface ObjectiveProgressResultDto {
  readonly actualValue?: number;
  readonly targetValue?: number;
  readonly percentComplete?: number;
  readonly daysElapsed?: number;
  readonly daysTotal?: number;
  readonly daysRemaining?: number;
  readonly requiredDailyPace?: number;
  readonly currentDailyPace?: number;
  readonly onTrack?: boolean;
  readonly campaignsOnPace?: number;
  readonly campaignsTotal?: number;
}

export interface GrowthObjectiveResponseDto {
  readonly id: string;
  readonly tenantId: string;
  readonly metric: "HOT_LEADS";
  readonly targetValue: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly budgetMode: "GOAL_FIRST" | "BUDGET_FIRST" | "BALANCED";
  readonly maxBudgetIdr?: number;
  readonly automationMode: "ADVISOR" | "COPILOT" | "AUTOPILOT_GUARDED" | "AUTONOMOUS";
  readonly status: GrowthObjectiveStatus;
  readonly forecast?: GrowthObjectiveForecastDto;
  readonly forecastComputedAt?: string;
  readonly progress?: ObjectiveProgressResultDto;
  readonly progressCheckedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface GrowthObjectiveListResponseDto {
  readonly objectives: readonly GrowthObjectiveResponseDto[];
}

export interface AbTestVariantDto {
  readonly id: string;
  readonly label?: string;
  readonly variantLabel?: string;
  readonly imageUrl?: string;
  readonly videoUrl?: string;
  readonly creativePackageId?: string;
}

export interface AbTestDto {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly variants: readonly AbTestVariantDto[];
}

export type CreativePackageStatusDto =
  "DRAFT" | "GENERATING" | "PENDING" | "APPROVED" | "REJECTED" | "FAILED";

export interface CreativePackageDto {
  readonly imageUrls?: readonly string[];
  readonly videoUrl?: string;
  readonly requestedFormat?: string;
  readonly decidedFormat?: string;
  readonly id: string;
  readonly title: string;
  readonly status: CreativePackageStatusDto;
  /**
   * Real `creative_packages.error_message` (aaos-api's `CreativePackageResponseDto.errorMessage`) —
   * populated when generation genuinely failed. Surfaced as a human-readable notice (raw provider
   * text stays in a tooltip only), never as the primary UI copy.
   */
  readonly errorMessage?: string;
  readonly createdAt: string;
}

/** Mirrors aaos-api's PendingActionResponseDto (modules/pending-actions/dto/pending-action-response.dto.ts). */
export interface PendingActionDto {
  readonly id: string;
  readonly tenantId: string;
  readonly agent: string;
  readonly actionType: string;
  readonly status: "PENDING" | "APPROVED" | "REJECTED";
  readonly createdAt: string;
}

export interface ApiErrorBody {
  readonly error: { readonly code?: string; readonly message: string };
}

/**
 * Mirrors apps/aaos-api's real `SamanthaSignalType`/`SamanthaSignal`
 * (modules/metric-snapshot/domain/signal-engine.ts) and `CampaignDiagnosis`/`SamanthaDecision`/
 * `MonitoringPlan`/`RecommendedActionType` (modules/campaign-health/domain/{diagnosis,decision}.ts),
 * as returned verbatim by the real, already-live `GET /api/v1/campaign-health/:campaignId`
 * (modules/campaign-health/dto/campaign-health-response.dto.ts). Hand-written client-safe copies,
 * same "never cross-import aaos-api internals" convention every other type in this file follows.
 */
export type SamanthaSignalType =
  | "CTR_DROP"
  | "CTR_IMPROVEMENT"
  | "CPL_SPIKE"
  | "CPL_IMPROVEMENT"
  | "FREQUENCY_RISE"
  | "CREATIVE_FATIGUE"
  | "SPEND_WITHOUT_RESULT"
  | "INSUFFICIENT_DATA";

export type SamanthaSignalSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SamanthaSignalDto {
  readonly type: SamanthaSignalType;
  readonly severity: SamanthaSignalSeverity;
  readonly metric?: string;
  readonly currentValue?: number;
  readonly baselineValue?: number;
  readonly deltaPct?: number;
  readonly confidence: number;
  readonly reasoning: string;
}

export type DiagnosisImpact = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";

export interface CampaignDiagnosisDto {
  readonly rootCause?: SamanthaSignalType;
  readonly confidence: number;
  readonly impact: DiagnosisImpact;
  readonly evidence: readonly SamanthaSignalDto[];
  readonly contributingFactors: readonly string[];
  readonly recommendedFocus: readonly string[];
}

/** Real `Verdict` values (`SCALE`/`KEEP`/`REVIEW`/`REFRESH`/`FIX`/`PAUSE`) plus the 3 honest additions `decision.ts` documents. */
export type RecommendedActionType =
  | "NO_ACTION"
  | "MONITOR"
  | "REQUEST_KAI_CREATIVE"
  | "SCALE"
  | "KEEP"
  | "REVIEW"
  | "REFRESH"
  | "FIX"
  | "PAUSE";

export interface MonitoringPlanDto {
  readonly reviewAfterHours: number;
  readonly successConditions: readonly string[];
  readonly rollbackConditions: readonly string[];
}

export interface SamanthaDecisionDto {
  readonly decision: RecommendedActionType;
  readonly primaryDiagnosis?: SamanthaSignalType;
  readonly confidence: number;
  readonly impact: DiagnosisImpact;
  readonly reason: string;
  readonly riskOfDoingNothing: string;
  readonly expectedOutcome: string;
  readonly monitoringPlan: MonitoringPlanDto;
}

/**
 * Real `CampaignHealth`/`HealthDimension` shape (`modules/campaign-health/domain/campaign-health.ts`)
 * — the 7-dimension health assessment that REPLACES the old single FIX/PAUSE/SCALE verdict.
 * `audience`/`tracking`/`leadQuality` are honestly ALWAYS `UNKNOWN` in this codebase today (no real
 * audience-saturation/pixel-health/CPQL data source exists yet) — never fabricated as a real status.
 */
export type HealthStatus = "HEALTHY" | "WATCH" | "WARNING" | "CRITICAL" | "UNKNOWN";

export interface HealthDimensionDto {
  readonly status: HealthStatus;
  /** `0`-`100` — omitted (not `0`) when `status` is `"UNKNOWN"`. The real data-sufficiency signal for this dimension, alongside `confidence`. */
  readonly score?: number;
  /** `0`-`1`. `0` when `status` is `"UNKNOWN"`. */
  readonly confidence: number;
  readonly issues: readonly string[];
}

export interface CampaignHealthDto {
  readonly delivery: HealthDimensionDto;
  readonly costEfficiency: HealthDimensionDto;
  readonly creative: HealthDimensionDto;
  readonly audience: HealthDimensionDto;
  readonly conversion: HealthDimensionDto;
  readonly tracking: HealthDimensionDto;
  readonly leadQuality: HealthDimensionDto;
  readonly overallStatus: HealthStatus;
}

/** Real `Opportunity` (`modules/opportunities/domain/opportunity.ts`) — this codebase honestly only supports these 2 types today (see that file's own header doc for why). */
export type OpportunityType = "SCALING_OPPORTUNITY" | "CREATIVE_WINNER_EXPANSION";

export interface OpportunityDto {
  readonly type: OpportunityType;
  readonly confidence: number;
  readonly description: string;
  readonly evidence: string;
}

/** One real per-campaign entry inside `AccountSummaryResponseDto.campaigns` — the SAME shape `GET /api/v1/campaign-health/:campaignId` returns for one campaign, plus real `campaignName`/`spend` so the frontend never needs a second lookup. */
/**
 * The ONE real Meta creative representing a campaign row — mirrors aaos-api's
 * `RepresentativeCreativeDto` (`command-center/dto/account-summary-response.dto.ts`) field for
 * field. Selected server-side by the real 5-tier priority (active winner -> highest spend ->
 * highest impressions -> most recently active -> listing fallback), never picked arbitrarily.
 *
 * Optional fields are genuinely absent, not empty: no `thumbnailUrl` means Meta did not resolve the
 * creative's real ref this pass (deleted asset, video still processing, rate-limited moment) and
 * the row falls back to its listing photo and then its honest placeholder; no `badge` means the
 * selected creative's real Samantha verdict / A/B-test outcome is neither winning nor fatigued; no
 * `kaiCreativePackageId`/`assetUrl` means this Meta ad genuinely has no persisted Kai-package link.
 */
export interface RepresentativeCreativeDto {
  /** Real Meta image `url`/`permalink_url`, or a real video poster-frame URI. Never a stock/placeholder-service URL. */
  readonly thumbnailUrl?: string;
  readonly kind: "IMAGE" | "VIDEO";
  readonly badge?: "WINNER" | "FATIGUED";
  /** Real Meta ad id of the ad whose creative was selected. */
  readonly metaAdId: string;
  /** Real Meta image HASH (IMAGE) or VIDEO ID (VIDEO) — the same value `meta_ads.creative_ref` stores. NOT a URL. */
  readonly metaCreativeRef: string;
  readonly priorityTier: 1 | 2 | 3 | 4;
  /** Real `creative_packages.id` — the Kai package this creative came from, when a real published-ad link exists. */
  readonly kaiCreativePackageId?: string;
  /** Real Kai-side generated asset URL (GCS) from that package. */
  readonly assetUrl?: string;
}

/** The real `meta_insights_daily` column a row's mini-sparkline series is measured in — mirrors aaos-api's `CampaignTrendMetric`. */
export type CampaignTrendMetric = "ctr" | "cpl" | "frequency";

/**
 * Samantha Attention Queue row mini sparkline — mirrors aaos-api's `CampaignTrendDto`
 * (`command-center/dto/account-summary-response.dto.ts`) field for field.
 *
 * A real, per-campaign daily series read from `meta_insights_daily` (a Postgres read: ZERO Meta Ads
 * API calls), computed server-side inside the same 5-minute-cached `account-summary` this row
 * already renders from — so the sparkline costs no extra request from the browser and can never
 * delay the row.
 *
 * `metric` is picked from the campaign's own real `diagnosis.rootCause`, so the series is the metric
 * the diagnosis is actually about. The whole field is genuinely ABSENT (never a flat placeholder
 * line) when the campaign has fewer than 2 real days, its root cause maps to no such series, or the
 * real history read failed.
 */
export interface CampaignTrendDto {
  readonly metric: CampaignTrendMetric;
  /** Real daily values, oldest-to-newest. At least 2 entries whenever present. */
  readonly points: readonly number[];
}

export interface CampaignHealthSummaryEntryDto {
  readonly campaignId: string;
  readonly campaignName: string;
  readonly spend: number;
  readonly health: CampaignHealthDto;
  readonly diagnosis: CampaignDiagnosisDto;
  readonly decision: SamanthaDecisionDto;
  readonly representativeCreative?: RepresentativeCreativeDto;
  /** See `CampaignTrendDto` — additive/optional, honestly absent rather than fabricated. */
  readonly trend?: CampaignTrendDto;
}

/**
 * `GET /api/v1/command-center/account-summary` response — the ONE real, account-wide aggregate
 * backing Needs Attention / Opportunities / Samantha Decision Queue. Replaces this app's previous
 * reliance on the legacy per-ad `Verdict` aggregation (`computeCampaignVerdicts`) for these 3
 * sections entirely — every number here traces to the real Samantha V2 domain model instead.
 */
export interface AccountSummaryResponseDto {
  readonly tenantId: string;
  readonly generatedAt: string;
  readonly campaignsAnalyzed: number;
  readonly campaignsCapped: boolean;
  readonly campaigns: readonly CampaignHealthSummaryEntryDto[];
  readonly opportunities: readonly OpportunityDto[];
  readonly errors: Readonly<Record<string, string>>;
}

/**
 * Real `GET /api/v1/campaigns/:campaignId/listing-id` response
 * (`MetaAdsController.getCampaignListingId` -> `MetaSyncService.getCampaignListingId`, persisted by
 * migration `053_meta_campaigns_listing_id.sql`). `listingId` is genuinely `null` for every campaign
 * that was never linked to a listing — never a fabricated fallback id.
 */
export interface CampaignListingIdResponseDto {
  readonly campaignId: string;
  readonly listingId: string | null;
}

/** One real photo inside `listings.photos` JSONB — `PhotoResponseDto` in aaos-api's `listings/dto/listing.dto.ts`. */
export interface ListingPhotoDto {
  readonly id: string;
  readonly url: string;
  readonly label?: string;
  readonly order: number;
  readonly isMain: boolean;
}

/**
 * The subset of aaos-api's real `ListingResponseDto` (`GET /api/v1/listings/:id`) this app actually
 * reads — the Samantha Attention Queue only needs the real property photo for a row's thumbnail.
 * `mainPhotoUrl` is computed server-side as `photos.find(isMain)?.url ?? photos[0]?.url ?? null`
 * (`ListingsService.mainPhotoUrlOf`) and is therefore genuinely absent when a listing has no photos.
 */
export interface ListingDto {
  readonly id: string;
  readonly title: string;
  readonly photos: readonly ListingPhotoDto[];
  readonly mainPhotoUrl?: string;
}
