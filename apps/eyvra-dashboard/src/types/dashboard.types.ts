/**
 * Client-safe DTO shapes returned by this app's own `src/app/api/*` proxy routes — deliberately
 * NOT imported from `apps/aaos-api`'s internal `dto/*.ts` files (a different app) or any `@aos/*`
 * package. Kept as plain, hand-written interfaces so nothing here can ever accidentally pull a
 * Node-only runtime value into a `"use client"` bundle (AAOS-W4A coordinator note #2).
 */

export interface AdMetricsDto {
  readonly spend: number;
  readonly clicks: number;
  /** AAOS-SAMANTHA-PAGES redesign (coordinator note #3): mirrors `AdMetricsResponseDto.frequency` on the real `aaos-api` response — plumbed through so "Audit Biaya"'s "Audiens jenuh (frequency >= 3.5)" waste-detection section can work off real per-ad data, same pattern as `clicks`. */
  readonly frequency: number;
  readonly conversations: number;
  readonly d2: number;
  readonly d3: number;
  readonly d5: number;
  readonly leadForm: number;
  readonly totalLead: number;
  readonly rphD3: number | null;
  /** AAOS-DASHBOARD-LEAD-SPEND-CABANG-SOURCE: mirrors `AdMetricsResponseDto.rphLead` on the real `aaos-api` response (`spend / totalLead`, division-by-zero safe — see `Rph`/`AdMetrics` in `@aos/meta-ads-connector`). Was already computed server-side but never plumbed through this app's DTOs; added so "Lead & Spend per Cabang × Source"'s "RP/LEAD" column can reuse the real per-ad value rather than re-deriving it, same discipline as `rphD3`. */
  readonly rphLead: number | null;
  /**
   * Sprint 5 Prompt 13 (Campaigns "Metrics" tab): mirrors `AdMetricsResponseDto.impressions` on the
   * real `aaos-api` response (`@aos/meta-ads-connector`'s `Ad.metrics.impressions`) — a genuinely
   * real field the connector/backend already return (see `toAdResponseDto` in
   * `apps/aaos-api/src/modules/meta-ads/dto/campaign-response.dto.ts`) that this app's `/api/campaigns`
   * proxy never forwarded until now (same class of gap `rphLead`'s own docstring documents: "already
   * computed server-side but never plumbed through this app's DTOs"). Optional, like
   * `daysSinceCreation` above, so the ~24 existing test fixtures that construct an `AdMetricsDto`
   * literal without it keep compiling — never widened to required just for one new tab's sake.
   */
  readonly impressions?: number;
  /**
   * Real, already-pulled `AdMetricsResponseDto.reach` (`@aos/meta-ads-connector`'s `Ad.metrics.reach`)
   * — same "already computed server-side, never plumbed through this app's DTOs" gap `impressions`'
   * own docstring documents, closed here for the AdAdvisor-style campaign table (user-requested:
   * "data table campaign nya lengkap gini kaya di adavisor"). Optional, same rationale as
   * `impressions` — existing `AdMetricsDto` fixtures across the app keep compiling without it.
   */
  readonly reach?: number;
}

export interface CampaignAdDto {
  readonly id: string;
  /**
   * Real, stable Meta ad id (`aaos-api`'s `AdResponseDto.metaId`) — bug fix (live-confirmed via
   * `aaos-api` logs): `id` is a LOCAL id re-generated randomly on every single live pull
   * (`CampaignMapper`/`AdSetMapper`/`AdMapper`'s own `*Id.generate()`), so it can never be used to
   * identify this ad in a LATER, separate request (e.g. `POST /api/verdicts`'s real Meta mutation,
   * or a second live pull like `getAndromedaHealth`'s own). `metaId` is the one real, permanent
   * Meta object id — always use THIS for anything crossing a request boundary.
   */
  readonly metaId: string;
  readonly stableId: string;
  readonly name: string;
  readonly campaignName: string;
  readonly status: string;
  readonly funnel: string;
  readonly branch: string;
  readonly verdict: string;
  readonly metrics: AdMetricsDto;
  /** AAOS-SAMANTHA-PAGES redesign: mirrors `AdResponseDto.daysSinceCreation` on the real `aaos-api` response — powers "Audit Biaya"'s "Iklan Baru (last 14 days)" section. Optional (unlike `frequency`) rather than a required field on every existing fixture/caller: this app's other, already-shipped pages have no use for it, so widening every `CampaignAdDto`/`AdSummaryDto` literal across the codebase for one new section's sake isn't warranted — callers that need it check for `undefined`. */
  readonly daysSinceCreation?: number;
  /**
   * AAOS Samantha Professional Optimizer, Part B/D — real, already-pulled ad-copy text (each
   * independently `undefined` when Meta's creative for this ad doesn't carry it — see
   * `aaos-api`'s `AdResponseDto` docstring). Powers `POST /api/diagnose-ad-copy`'s real
   * Hook/Clear-Problem/To-The-Point/Soft-CTA + Pain/Offer/USP analysis for this ad.
   */
  readonly primaryText?: string;
  readonly headline?: string;
  readonly description?: string;
  /** AAOS Samantha Professional Optimizer, Part A/D — the parent adset's real `learning_stage_info.status`, inherited here so a per-ad view (`CampaignDetailClient`) can show the same "Masih Learning Phase" signal without a second lookup. */
  readonly learningStatus?: string;
}

/** One ad within `AdSetSummaryDto.ads` — the `#C` level of the campaign→ad-set→ad hierarchy (spec "meta-ads/page.tsx" MAAO2 redesign). Distinct from `CampaignAdDto` only in that it omits `campaignName` (redundant once nested under its own campaign). */
export interface AdSummaryDto {
  readonly id: string;
  /** See `CampaignAdDto.metaId`'s own doc — same real, stable, cross-request-safe Meta ad id, same bug fix. */
  readonly metaId: string;
  readonly stableId: string;
  readonly name: string;
  readonly status: string;
  readonly funnel: string;
  readonly branch: string;
  readonly verdict: string;
  readonly metrics: AdMetricsDto;
  /** See `CampaignAdDto.daysSinceCreation` — same field, same optionality rationale. */
  readonly daysSinceCreation?: number;
  /** See `CampaignAdDto.primaryText`/`.headline`/`.description` — same fields, same optionality rationale. */
  readonly primaryText?: string;
  readonly headline?: string;
  readonly description?: string;
}

/** The `#B` level. `stableId`/`spend` come straight from `aaos-api`'s real, already spend-sorted assignment (`@aos/meta-ads-connector`'s `StableIdAssigner`) — never recomputed client-side. */
export interface AdSetSummaryDto {
  readonly id: string;
  /** See `CampaignAdDto.metaId`'s own doc — same real, stable, cross-request-safe Meta ad-set id, same bug fix. */
  readonly metaId: string;
  readonly stableId: string;
  readonly name: string;
  readonly status: string;
  readonly spend: number;
  /**
   * Real, already-pulled `AdSetResponseDto.dailyBudget` (Meta's real per-ad-set daily budget cap)
   * — was already in `aaos-api`'s response but never forwarded by this app's `/api/campaigns`
   * proxy (same class of gap as `AdMetricsDto.reach`'s own doc), closed for the AdAdvisor-style
   * campaign table (user-requested). Required (not optional): every real ad set genuinely carries
   * one from Meta, unlike `reach`/`impressions` which can be legitimately absent per-ad.
   */
  readonly dailyBudget: number;
  readonly ads: readonly AdSummaryDto[];
  /** AAOS Samantha Professional Optimizer, Part A/D — real Meta `learning_stage_info.status`, `undefined` when Meta didn't report one for this adset. */
  readonly learningStatus?: string;
}

/** The `#A` level. Same authoritative-`stableId`-from-backend contract as `AdSetSummaryDto`. */
export interface CampaignSummaryDto {
  readonly id: string;
  /**
   * Real, stable Meta campaign id (bug fix — see `CampaignAdDto.metaId`'s own doc for the full
   * "why `id` alone is unsafe across requests" reasoning, live-confirmed via a 404 from
   * `getAndromedaHealth`: the SAME campaign got a different random `id` on two separate live
   * pulls). ALWAYS use `metaId`, never `id`, as `targetId` for `POST /api/verdicts` or as the
   * `campaignId` param for any endpoint that re-pulls and looks the campaign back up (e.g.
   * Andromeda Health).
   */
  readonly metaId: string;
  readonly stableId: string;
  readonly name: string;
  readonly objective: string;
  readonly status: string;
  readonly spend: number;
  /**
   * Real Meta `daily_budget`, present ONLY for a Campaign Budget Optimization (CBO) campaign —
   * `0` for a non-CBO campaign, whose real per-ad-set budgets live on each
   * `AdSetSummaryDto.dailyBudget` instead. AAOS never requested this campaign-level field until
   * now (user-reported gap: "saya cek daily budget masih... kosong" on the AdAdvisor-style
   * table — a CBO campaign's Daily Budget column was a permanent "—" even though Meta genuinely
   * has the number, just not where the ad-set-level sum alone was looking for it). See
   * `campaignInsightMath.ts`'s `aggregateCampaign` for the real fallback: ad-set-level sum first,
   * this field only when that sum is 0.
   */
  readonly dailyBudget: number;
  readonly adSets: readonly AdSetSummaryDto[];
}

export interface AdAccountSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly syncedAt: string;
  /** Full campaign→ad-set→ad hierarchy — powers the MAAO2-style tree (`CampaignTree`). */
  readonly campaigns: readonly CampaignSummaryDto[];
  /** The same ads, flattened — kept for `CampaignDetailClient` (`/meta-ads/[campaignId]`), which looks up one ad by id and has no use for the tree structure. */
  readonly ads: readonly CampaignAdDto[];
  readonly totals: AdMetricsDto;
  readonly campaignCount: number;
  readonly adCount: number;
}

/**
 * SAMANTHA ADVANCED SPRINT 2 — one real per-ad row of `CampaignInsightRequestDto.ads`. Mirrors
 * `aaos-api`'s `CampaignInsightAdSchema` field-for-field; see that schema's own doc for the real
 * source of each field (the same `AdSummaryDto`/`AdSetSummaryDto` data `CampaignAdDrillDown.tsx`
 * already renders).
 */
export interface CampaignInsightAdDto {
  readonly stableId: string;
  readonly name: string;
  readonly verdict: string;
  readonly spend: number;
  readonly conversations: number;
  readonly rphChatIDR: number | null;
  readonly frequency: number;
  readonly learningStatus?: string;
}

export type CampaignInsightDiversityStatus = "NOT_ENOUGH_DATA" | "LOW_DIVERSITY" | "DIVERSE";

/**
 * SAMANTHA ADVANCED INSIGHT ENGINE — real Andromeda creative-diversity signal, mirrored from
 * `AndromedaHealthDto.diversity` (the SAME real, already-fetched data `AndromedaHealthCard.tsx`
 * shows immediately below `CampaignInsightPanel`) — reused rather than re-scored, so the two can
 * never disagree about the same campaign.
 */
export interface CampaignInsightAndromedaDiversityDto {
  readonly status: CampaignInsightDiversityStatus;
  readonly totalAdCount: number;
  readonly distinctCreativeAssetCount?: number;
  readonly reasoning: string;
}

/**
 * AAOS-CAMPAIGNS-UNIFIED-PAGE — `POST /api/campaign-insight` request body (proxies `aaos-api`'s
 * real `POST /api/v1/campaigns/insight`). Composed CLIENT-SIDE from one selected campaign's
 * already-loaded real aggregate metrics — see `aaos-api`'s `CampaignInsightRequestSchema` (the
 * server-side Zod trust boundary this shape mirrors) for the full field-by-field real-source doc.
 *
 * SAMANTHA ADVANCED SPRINT 2 additions (`ads`/`learningAdSetStableIds`/`marketDigest`) and SAMANTHA
 * ADVANCED INSIGHT ENGINE additions (`dailyBudget`/`cpc`/`cpm`/`reach`/`*Trend7d`/
 * `andromedaDiversity`/`hotLeadsCount`) are all real, already-computed/already-fetched fields — see
 * `aaos-api`'s `CampaignInsightRequestSchema` for the full real-source doc per field.
 */
export interface CampaignInsightRequestDto {
  readonly campaignId: string;
  readonly campaignName: string;
  readonly verdict: string;
  readonly spend: number;
  readonly totalLead: number;
  readonly clicks: number;
  readonly impressions: number | null;
  readonly maxFrequency: number;
  readonly adCount: number;
  readonly adSetCount: number;
  readonly cpl: number | null;
  readonly benchmarkCplIDR: number | null;
  readonly dailyBudget: number;
  readonly cpc: number | null;
  readonly cpm: number | null;
  readonly reach: number | null;
  readonly ads?: readonly CampaignInsightAdDto[];
  readonly learningAdSetStableIds?: readonly string[];
  readonly marketDigest?: string | null;
  readonly ctrTrend7d?: readonly number[];
  readonly spendTrend7d?: readonly number[];
  readonly resultsTrend7d?: readonly number[];
  readonly freqTrend7d?: readonly number[];
  readonly andromedaDiversity?: CampaignInsightAndromedaDiversityDto;
  readonly hotLeadsCount?: number;
}

/**
 * `POST /api/ads/diagnose-copy` request body (proxies `aaos-api`'s real
 * `POST /api/v1/ads/diagnose-copy` — `MetaAdsController.getAdCopyDiagnosis` →
 * `LlmService.diagnoseAdCopy`, AAOS Samantha Professional Optimizer Part C). Composed CLIENT-SIDE
 * from one already-loaded `AdSummaryDto`'s real fields — mirrors `aaos-api`'s
 * `DiagnoseAdCopyRequestSchema` (the server-side Zod trust boundary this shape restates) field for
 * field. `primaryText`/`headline`/`description` are each independently possibly `undefined` (Meta's
 * real creative for this ad may not carry them) — never fabricated when absent, the backend's own
 * `NO_COPY_TEXT` honest degrade handles that case.
 */
export interface DiagnoseAdCopyRequestDto {
  readonly adName: string;
  readonly primaryText?: string;
  readonly headline?: string;
  readonly description?: string;
  readonly verdict: string;
  readonly isUnderperforming: boolean;
  readonly spend: number;
  readonly conversations: number;
  readonly rphChatIDR: number | null;
  readonly frequency: number;
  readonly learningStatus?: "LEARNING" | "LEARNING_LIMITED" | "SUCCESS";
}

/** One YES/NO/PARTIAL structural element of the Hook/Clear-Problem/To-The-Point/Soft-CTA evaluation. Mirrors `aaos-api`'s `StructuralElementSchema`. */
export interface AdCopyStructuralElementDto {
  readonly status: "YES" | "NO" | "PARTIAL";
  readonly reasoning: string;
}

/** The real Pain/Offer/USP (or `UNCERTAIN`) underperformance diagnosis. Mirrors `aaos-api`'s `DiagnosisSchema`. Present only when the request's `isUnderperforming` was `true`. */
export interface AdCopyDiagnosisIssueDto {
  readonly issue: "PAIN" | "OFFER" | "USP" | "UNCERTAIN";
  readonly reasoning: string;
}

/** Mirrors `aaos-api`'s `DiagnoseAdCopyResponseDto` — same `available: false` union (`reason`/`message`) every other real `llm` endpoint in this app can return, PLUS the `NO_COPY_TEXT` reason unique to this endpoint (`AdMetricsDto`/`AdSummaryDto`'s own `primaryText`/`headline`/`description` docstrings — Meta's creative for this ad carried no usable copy text). Never a fabricated diagnosis when `available: false`. */
export type DiagnoseAdCopyResponseDto =
  | {
      readonly available: true;
      readonly structural: {
        readonly hook: AdCopyStructuralElementDto;
        readonly clearProblem: AdCopyStructuralElementDto;
        readonly toThePoint: AdCopyStructuralElementDto;
        readonly softCta: AdCopyStructuralElementDto;
      };
      readonly diagnosis?: AdCopyDiagnosisIssueDto;
      readonly learningPhaseNote?: string;
    }
  | {
      readonly available: false;
      readonly reason:
        "NO_API_KEY" | "RATE_LIMITED" | "PROVIDER_ERROR" | "INVALID_RESPONSE" | "NO_COPY_TEXT";
      readonly message: string;
    };

export type CampaignInsightTriageLevel = "DARURAT" | "KRITIS" | "PERLU_PERHATIAN" | "SEHAT";
export type CampaignInsightVerdict = "SCALE" | "KEEP" | "REVIEW" | "REFRESH" | "FIX" | "PAUSE";
export type CampaignInsightMetricStatus = "critical" | "warning" | "good" | "neutral";
export type CampaignInsightTrend = "naik" | "turun" | "stabil";
export type CampaignInsightKaiUrgency = "immediate" | "this_week" | "next_cycle";
export type CampaignInsightBudgetRecommendation = "increase" | "maintain" | "decrease" | "pause";

export interface CampaignInsightPlaybookStep {
  readonly action: string;
  readonly how: string;
  readonly why: string;
  readonly expectedResult: string;
  readonly risk_if_not?: string;
}

export interface CampaignInsightMetricBreakdownDto {
  readonly metric: string;
  readonly status: CampaignInsightMetricStatus;
  readonly interpretation: string;
  readonly vsContext: string;
  readonly trend: CampaignInsightTrend;
  readonly trendDetail: string;
}

export interface CampaignInsightScenarioDto {
  readonly name: string;
  readonly probability: string;
  readonly steps: readonly string[];
  readonly expectedOutcome: string;
  readonly timeToResult: string;
  readonly risk?: string;
}

/**
 * SAMANTHA ADVANCED INSIGHT ENGINE — mirrors `aaos-api`'s `CampaignInsightLlmPayloadSchema`, a
 * full rewrite of Campaign Page Rebuild v2's `diagnosis`/`metricEvidence`/`actions` shape into a
 * senior-media-buyer diagnosis framework (Triage → Root Cause → Evidence → Treatment →
 * Prognosis). See that schema's own doc for why each field is real model REASONING over real
 * inputs, never a fabricated metric.
 */
export type CampaignInsightResponseDto =
  | {
      readonly available: true;
      readonly triage: { readonly level: CampaignInsightTriageLevel; readonly why: string };
      readonly verdict: CampaignInsightVerdict;
      readonly confidence: number;
      readonly verdictOneLiner: string;
      readonly rootCause: {
        readonly primary: string;
        readonly primaryEvidence: string;
        readonly secondary?: string;
        readonly ruled_out?: string;
      };
      readonly metricBreakdown: readonly CampaignInsightMetricBreakdownDto[];
      readonly whatHappened: string;
      readonly playbook: {
        readonly immediate: CampaignInsightPlaybookStep;
        readonly shortTerm: CampaignInsightPlaybookStep;
        readonly mediumTerm: CampaignInsightPlaybookStep;
      };
      readonly kaiDirective: {
        readonly needed: boolean;
        readonly urgency?: CampaignInsightKaiUrgency;
        readonly brief?: string;
        readonly angles_to_avoid?: string;
        readonly reasoning?: string;
      };
      readonly budgetDecision: {
        readonly recommendation: CampaignInsightBudgetRecommendation;
        readonly currentBudget: number;
        readonly recommendedBudget: number;
        readonly changePercent: number;
        readonly reasoning: string;
        readonly prerequisite?: string;
        readonly opportunityCost?: string;
      };
      readonly scenarios: readonly CampaignInsightScenarioDto[];
      readonly competitorContext?: string;
      readonly learnings: readonly string[];
      readonly proTip?: string;
    }
  | { readonly available: false; readonly reason: string; readonly message: string };

/**
 * Campaign Page Rebuild v2 — mirrors `aaos-api`'s `CampaignHistoryResponseDto`
 * (`GET /api/v1/campaigns/:campaignId/history`, real already-persisted `meta_insights_daily` rows).
 * `points` is ordered oldest-to-newest — exactly the shape a sparkline needs. An empty array is a
 * real, honest result (never fabricated) for a campaign with no captured history yet.
 */
export interface CampaignHistoryPointDto {
  readonly date: string;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly frequency: number;
  readonly ctr: number;
  readonly cpl: number;
  readonly leads: number;
}

export interface CampaignHistoryResponseDto {
  readonly campaignId: string;
  readonly points: readonly CampaignHistoryPointDto[];
}

/**
 * SAMANTHA META ADS SETTINGS + CREATIVE COPY — mirrors `aaos-api`'s `MetaSettingsListingSchema`
 * field-for-field (the REAL `ListingDto` fields this feature actually has access to — see that
 * schema's own doc for why there's no `facilities`/KPR field anywhere in this codebase).
 */
export interface MetaSettingsListingDto {
  readonly propertyType: string;
  readonly price: number;
  readonly city?: string;
  readonly kecamatan?: string;
  readonly landArea?: number;
  readonly buildArea?: number;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly certificate?: string;
  readonly highlights: readonly string[];
  readonly description?: string;
}

/**
 * `POST /api/campaigns/:campaignId/settings-recommendation` request body (proxies `aaos-api`'s
 * real `POST /api/v1/campaigns/settings-recommendation`). Composed CLIENT-SIDE from the same
 * already-loaded real aggregate metrics `CampaignInsightRequestDto` uses, plus a real `listing`
 * only when a `listingId` prop was passed to the panel — see `MetaSettingsPanel`'s own doc for why
 * that's `undefined` in the common case today (no persisted campaign→listing mapping exists).
 */
export interface MetaSettingsRecommendationRequestDto {
  readonly campaignId: string;
  readonly campaignName: string;
  readonly objective: string;
  readonly status: string;
  readonly verdict: string;
  readonly ctr: number | null;
  readonly cpl: number | null;
  readonly benchmarkCplIDR: number | null;
  readonly benchmarkCtr: number | null;
  readonly maxFrequency: number;
  readonly totalLead: number;
  readonly spend: number;
  readonly dailyBudget: number;
  readonly listing?: MetaSettingsListingDto;
}

export type MetaAudienceStrategy =
  "BROAD_ADVANTAGE_PLUS" | "INTEREST" | "RETARGETING" | "LOOKALIKE";
export type MetaGender = "all" | "male" | "female";
export type MetaInterestCategory = "property" | "finance" | "lifestyle" | "location";
export type MetaReachSize = "kecil" | "medium" | "besar";
export type MetaCampaignObjective = "OUTCOME_LEADS" | "OUTCOME_SALES" | "OUTCOME_ENGAGEMENT";
export type MetaBidStrategy = "LOWEST_COST" | "BID_CAP" | "COST_CAP";
export type MetaOptimizationGoal = "LEAD_GENERATION" | "CONVERSATIONS" | "LINK_CLICKS";
export type MetaPlacementType = "ADVANTAGE_PLUS" | "MANUAL";
/** Real, already-existing 2-member format enum (`DiverseCreativeBriefSetRequestDto`/`PropertyCreatePackageBodySchema`). */
export type MetaCreativeFormat = "VIDEO_AND_IMAGES" | "IMAGES_ONLY";
/** Real 8-member `PropertyAdAngle` enum (`@aos/creative-agent`) — see `aaos-api`'s `meta-settings-recommendation.dto.ts` for why this replaces a fabricated angle taxonomy. */
export type PropertyAdAngleValue =
  | "DP_RINGAN"
  | "READY_HUNI"
  | "INVESTASI"
  | "EXCLUSIVE"
  | "SYARIAH"
  | "PROMO_TERBATAS"
  | "TESTIMONIAL"
  | "VIRTUAL_TOUR";

export interface MetaGeoLocationDto {
  readonly name: string;
  readonly radiusKm: number;
  readonly radiusRationale: string;
}

export interface MetaInterestDto {
  readonly name: string;
  readonly category: MetaInterestCategory;
  readonly relevance: string;
  readonly estimatedReach: MetaReachSize;
}

export interface MetaCreativeCopyDto {
  readonly angle: PropertyAdAngleValue;
  readonly targetPersona: string;
  readonly hook: string;
  readonly headline: string;
  readonly primaryText: string;
  readonly description: string;
  readonly cta: string;
  readonly recommendedFormat: MetaCreativeFormat;
  readonly visualDirection: string;
  readonly whyThisWorks: string;
}

export interface MetaAbTestEntryDto {
  readonly test: string;
  readonly variantAAngle: PropertyAdAngleValue;
  readonly variantBAngle: PropertyAdAngleValue;
  readonly hypothesis: string;
  readonly metric: string;
  readonly winnerCriteria: string;
}

/**
 * SAMANTHA META ADS SETTINGS + CREATIVE COPY — mirrors `aaos-api`'s
 * `MetaSettingsRecommendationLlmPayloadSchema` field-for-field. Every field is Samantha's own
 * generated recommendation/reasoning over real inputs — advisory text for a human media buyer to
 * apply manually in Meta Ads Manager. Deliberately NO Meta geo/interest ID field and NO "apply
 * settings" action anywhere in this shape — see that schema's own doc for why neither has real
 * backing in this codebase.
 */
export type MetaSettingsRecommendationResponseDto =
  | {
      readonly available: true;
      readonly audienceSettings: {
        readonly strategy: MetaAudienceStrategy;
        readonly strategyRationale: string;
        readonly geoTargeting: {
          readonly locations: readonly MetaGeoLocationDto[];
          readonly excluded: readonly string[];
          readonly geoRationale: string;
        };
        readonly demographics: {
          readonly ageMin: number;
          readonly ageMax: number;
          readonly gender: MetaGender;
          readonly ageRationale: string;
          readonly note?: string;
        };
        readonly interestTargeting: {
          readonly use: boolean;
          readonly useRationale: string;
          readonly interests: readonly MetaInterestDto[];
          readonly interestStacking: boolean;
          readonly stackingWarning?: string;
        };
        readonly customAudiences: {
          readonly retargeting: {
            readonly recommended: boolean;
            readonly source?: string;
            readonly rationale: string;
          };
          readonly lookalike: {
            readonly recommended: boolean;
            readonly sourcePct?: string;
            readonly rationale: string;
          };
        };
        readonly specialAdCategory: {
          readonly required: boolean;
          readonly category: string;
          readonly implications: string;
        };
      };
      readonly campaignSettings: {
        readonly objective: MetaCampaignObjective;
        readonly objectiveRationale: string;
        readonly buyingType: string;
        readonly campaignBudgetOptimization: boolean;
        readonly cboRationale: string;
        readonly bidStrategy: MetaBidStrategy;
        readonly bidStrategyRationale: string;
        readonly bidCap?: number;
        readonly adSchedule: { readonly use: boolean; readonly rationale: string };
      };
      readonly adSetSettings: {
        readonly structure: string;
        readonly optimizationGoal: MetaOptimizationGoal;
        readonly optimizationRationale: string;
        readonly billingEvent: string;
        readonly budgetRecommendation: {
          readonly dailyBudget: number;
          readonly minViable: number;
          readonly idealForLearning: number;
          readonly rationale: string;
        };
        readonly placementStrategy: {
          readonly type: MetaPlacementType;
          readonly placements: readonly string[];
          readonly excluded: readonly string[];
          readonly rationale: string;
        };
      };
      readonly creativeRecommendations: {
        readonly diversityTarget: string;
        readonly copies: readonly MetaCreativeCopyDto[];
        readonly copyPrinciples: readonly string[];
        readonly abTestMatrix: readonly MetaAbTestEntryDto[];
      };
      readonly trackingSetup: {
        readonly pixelRequired: boolean;
        readonly capi: {
          readonly required: boolean;
          readonly rationale: string;
          readonly eventsToTrack: readonly string[];
        };
        readonly utmParams: { readonly template: string; readonly rationale: string };
        readonly waLinkSetup: string;
      };
      readonly settingsSummaryCard: {
        readonly oneLineRecommendation: string;
        readonly topPriorityChange: string;
        readonly estimatedImpact: string;
      };
    }
  | { readonly available: false; readonly reason: string; readonly message: string };

/** `GET /api/v1/meta-ads/accounts` proxy response entry (AAOS-DASHBOARD-LEAD-SPEND-CABANG-SOURCE coordinator note #6) — powers the multi-account pill selector on "Lead & Spend per Cabang × Source". */
export interface AdAccountOptionDto {
  readonly id: string;
  readonly name: string;
}

/**
 * `GET /api/v1/analytics/heatmap` proxy response shapes (AAOS Analytics Platform Phase 3,
 * "Audience × Creative Heatmap" — `apps/aaos-api/src/modules/meta-ads/dto/heatmap.dto.ts`). Real
 * `AudienceLabel` bucket values from `@aos/meta-ads-connector`'s `classifyAudience` (Phase 3's
 * `AdSet.audienceLabel` wiring) — restated here as a plain string union since this "use client"
 * bundle cannot import that backend-only package.
 */
export type AudienceLabelDto = "BROAD" | "INTEREST" | "LOOKALIKE_1" | "RETARGETING" | "CUSTOM_CRM";

export interface HeatmapCellDto {
  readonly assetKind: "IMAGE" | "VIDEO";
  readonly assetId: string;
  readonly audienceLabel: AudienceLabelDto;
  readonly adCount: number;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly totalLead: number;
  readonly maxFrequency: number;
  readonly ctr: number | null;
  readonly cpm: number | null;
  readonly cpl: number | null;
}

export interface HeatmapResponseDto {
  readonly adAccountId: string;
  readonly generatedAt: string;
  readonly cells: readonly HeatmapCellDto[];
  readonly creativeAssetIds: readonly string[];
  readonly audienceLabels: readonly AudienceLabelDto[];
  readonly untaggedAdCount: number;
  readonly benchmarkCplIDR: number | null;
  readonly insightText: string;
}

/**
 * `GET /api/v1/analytics/assets/:assetId` proxy response shapes (AAOS Analytics Platform Phase 4,
 * "Asset detail / Creative Drill-Down" — `apps/aaos-api/src/modules/meta-ads/dto/asset-detail.dto.ts`).
 * Named `AssetCopyVariantDto`/`AssetAudienceBreakdownDto` (not `CopyVariantDto`) to avoid colliding
 * with this file's own pre-existing, unrelated `CopyVariantDto` (a `creative_packages` review
 * concept, not a Meta-ads-performance one).
 */
export interface AssetCopyVariantDto {
  readonly adId: string;
  readonly stableId: string;
  readonly name: string;
  readonly branch: string;
  readonly audienceLabel: AudienceLabelDto | undefined;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly totalLead: number;
  readonly frequency: number;
  readonly cpl: number | null;
}

export interface AssetAudienceBreakdownDto {
  readonly audienceLabel: AudienceLabelDto;
  readonly adCount: number;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly totalLead: number;
  readonly maxFrequency: number;
  readonly cpl: number | null;
}

/**
 * Mirrors `aaos-api`'s `LlmUnavailableResponseDto` union shape — same "available: false" degrade
 * contract every other real LLM-backed dashboard call (`LlmCreativeBriefResponseDto`, etc.) already
 * uses. `kaiTake`/`samanthaVerdict` (Creative Hub "4 gaps" dispatch, gap 3): replaces the old single
 * `summary` field — see `aaos-api`'s `AssetInsightLlmPayloadSchema` docstring for the real
 * investigation behind rendering this as two distinct Kai/Samantha panels from ONE LLM call rather
 * than a second provider call site.
 */
export type AssetInsightDto =
  | { readonly available: true; readonly kaiTake: string; readonly samanthaVerdict: string }
  | { readonly available: false; readonly reason: string; readonly message: string };

/**
 * Kai Creative Engine Sprint 4 — mirrors `aaos-api`'s `PhotoAnalysisResponseDto`
 * (`POST /api/v1/llm/photo-analysis`, Sprint 1/2). Same `available: false` degrade contract every
 * other real LLM-backed dashboard call already uses.
 */
export type PhotoAnalysisDto =
  | {
      readonly available: true;
      readonly scene: "EKSTERIOR" | "INTERIOR" | "FASILITAS" | "DENAH" | "LAINNYA";
      readonly qualityScore: number;
      readonly marketingScore: number;
      readonly recommendedUse: "HERO" | "SUPPORTING" | "NOT_RECOMMENDED";
      readonly reasoning: string;
    }
  | { readonly available: false; readonly reason: string; readonly message: string };

export interface AssetDetailResponseDto {
  readonly adAccountId: string;
  readonly generatedAt: string;
  readonly assetKind: "IMAGE" | "VIDEO";
  readonly assetId: string;
  readonly adCount: number;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly totalLead: number;
  readonly maxFrequency: number;
  readonly rphLead: number | null;
  readonly copyVariants: readonly AssetCopyVariantDto[];
  readonly audienceBreakdown: readonly AssetAudienceBreakdownDto[];
  readonly topAudienceLabel: AudienceLabelDto | undefined;
  readonly insight: AssetInsightDto;
}

export interface ObjectiveDto {
  readonly id: string;
  readonly tenantId: string;
  readonly period: { readonly month: number; readonly year: number };
  readonly targetHotLeads: number;
  readonly budgetAllocation: number;
  readonly focusUnits: readonly string[];
  readonly areaPriorities: readonly string[];
  readonly status: string;
  readonly createdAt: string;
}

export interface CopyVariantDto {
  readonly id: string;
  readonly variantLabel: "A" | "B" | "C";
  readonly primaryText: string;
  readonly headline: string;
  readonly callToAction: string;
}

/**
 * AAOS-CREATIVE-REVIEW: `DRAFT` (saved, never sent to Kai — zero Kie AI spend) · `GENERATING`
 * (a human pressed "Kirim ke Kai"; the real pipeline is running) · `PENDING` (awaiting review) ·
 * `APPROVED`/`REJECTED` (reviewed) · `FAILED` (the real pipeline errored).
 */
export type CreativePackageStatusDto =
  "DRAFT" | "GENERATING" | "PENDING" | "APPROVED" | "REJECTED" | "FAILED";

/** `@aos/creative-agent`'s real `CreativeFormat` — a package-level decision, not a per-asset tag. */
export type CreativeFormatDto = "VIDEO_AND_IMAGES" | "IMAGES_ONLY";

export interface CreativePackageDto {
  readonly id: string;
  readonly briefId: string;
  readonly adId?: string;
  readonly stableId?: string;
  /**
   * K4 (`docs/PROMPT-AAOS-PROPERTY-CAMPAIGN-AND-CREATIVE.md`) — real finding: `aaos-api`'s
   * `CreativePackageResponseDto` (K1) already carries `vertical: "AUTOMOTIVE" | "PROPERTY"` and an
   * optional `listingId`, and already made `branch`/`unit`/`targetPersona` optional (a PROPERTY
   * package has none of the three) — this dashboard type was stale relative to that K1 change
   * (still declaring `branch`/`unit`/`targetPersona` as required `string`), which this phase fixes
   * so the shared REVIEW/PROCESSING queue can render a real PROPERTY package alongside AUTOMOTIVE
   * ones without lying about the response shape.
   */
  readonly vertical: "AUTOMOTIVE" | "PROPERTY";
  /** The real, tenant-scoped `listings.id` a PROPERTY package was generated from. Absent for AUTOMOTIVE packages. */
  readonly listingId?: string;
  readonly branch?: string;
  /** The scraped unit's `identityKey` — the key Kai matches source photos on. Absent for PROPERTY packages. */
  readonly unit?: string;
  readonly unitModel?: string;
  readonly title: string;
  readonly angle: string;
  readonly targetPersona?: string;
  readonly reason: string;
  readonly requestedFormat: CreativeFormatDto;
  /** What Kai's real `FormatDecider` decided — may downgrade to `IMAGES_ONLY` with no source photos. */
  readonly decidedFormat?: CreativeFormatDto;
  readonly primaryMessage: string;
  readonly urgency: "HIGH" | "MEDIUM" | "LOW";
  readonly origin: "MANUAL" | "SAMANTHA";
  readonly status: CreativePackageStatusDto;
  /**
   * `042_creative_packages_ai_recommended.sql` — real, persisted record of whether this brief's
   * angle was submitted as an accepted Kai recommendation (`src/lib/kaiRecommendations.ts`'s
   * threshold logic, `PropertyManualBriefForm.tsx`'s Step 2 checkbox). Only ever `true` for a
   * `PROPERTY` package today — `AUTOMOTIVE`'s `ManualBriefForm.tsx` has no recommendation logic.
   */
  readonly aiRecommended: boolean;
  /**
   * AAOS LOOP UPGRADE, Sprint 6 Prompt 16 — real, scheduler-computed fatigue status.
   * `044_creative_packages_fatigue.sql`. `FATIGUED` requires a real, confirmed 7-day CTR-trend drop
   * this app cannot compute yet (no historical/time-series metrics storage anywhere) — see
   * `apps/aaos-api`'s `scheduler/domain/fatigue.ts` for the full honest-degrade reasoning. In
   * practice, today, only `NORMAL`/`WARNING` are ever real, scheduler-written values.
   */
  readonly fatigueStatus: "NORMAL" | "WARNING" | "FATIGUED";
  /** Real asset-library photo URLs found for this unit when generation started. */
  readonly sourcePhotoUrls: readonly string[];
  readonly videoUrl?: string;
  readonly imageUrls: readonly string[];
  readonly copyVariants: readonly CopyVariantDto[];
  /** The real Kie AI model string, e.g. `veo3_fast+nano-banana-pro`. */
  readonly aiModel?: string;
  readonly confidenceScore?: number;
  readonly generationMs?: number;
  readonly selectedCopyVariantId?: string;
  readonly errorMessage?: string;
  readonly generatedAt?: string;
  readonly reviewedAt?: string;
  /**
   * Kai Creative Engine Sprint 5 (foundation), `052_creative_packages_published_ad_ids.sql` — real
   * Meta ad ids this package's own copy variants were published as (`CampaignsService.
   * publishPropertyAds`). `undefined` = never attempted. An empty array is a real, distinct
   * "attempted, every createAd failed" state — never conflated with "never attempted".
   */
  readonly publishedMetaAdIds?: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One row of the real, append-only `creative_logs` audit trail. */
export interface CreativeLogDto {
  readonly id: string;
  readonly packageId?: string;
  readonly fromAgent: string;
  readonly toAgent?: string;
  readonly eventType: string;
  readonly message: string;
  readonly brief?: unknown;
  readonly result?: unknown;
  readonly error?: string;
  readonly metadata?: unknown;
  readonly adId?: string;
  readonly stableId?: string;
  readonly createdAt: string;
}

export interface CreativePackageDetailDto {
  readonly package: CreativePackageDto;
  readonly logs: readonly CreativeLogDto[];
}

export interface SalesHumanDto {
  readonly id: string;
  readonly name: string;
  readonly waNumber: string;
  readonly status: "ON" | "BUSY" | "OFF";
  readonly maxLeadsPerDay: number;
  readonly todayLeadCount: number;
  readonly isAvailable: boolean;
}

export interface BranchDto {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly wabaPhoneNumber: string;
  readonly assignmentMode: "SMART_ASSIGN" | "ROUND_ROBIN" | "MANUAL";
  readonly maxLeadsPerSalesPerDay: number;
  readonly active: boolean;
  readonly team: readonly SalesHumanDto[];
  readonly availableCount: number;
  readonly queueSize: number;
  readonly todayAssignedCount: number;
}

export interface LeadDto {
  readonly id: string;
  readonly leadPhone: string;
  readonly leadName?: string;
  readonly branchId: string;
  readonly status: string;
  readonly temperature: string;
  readonly score: number;
  readonly createdAt: string;
  /**
   * MENU RESTRUCTURE FINAL widening — these were already present on `aaos-api`'s real
   * `LeadResponseDto` and forwarded verbatim by `/api/leads`'s passthrough JSON response; this
   * type just hadn't modeled them yet. `leadSource` powers `/clara/contacts`'s "Source" column;
   * `assignedSalesId`/`lastMessageAt` power `/clara/inbox`'s Human/Bot tab split (coordinator note
   * #3 — an `assignedSalesId` present is the real signal for an ACTIVE `assignments` row, since
   * this domain has no lead-assignment "release" path yet) and "Last Seen" column.
   */
  readonly leadSource?: string;
  readonly assignedSalesId?: string;
  readonly lastMessageAt?: string;
  /**
   * Campaign Page Rebuild v2 (Prompt 4) — real `aaos-api` `LeadResponseDto.campaignId`, already
   * forwarded verbatim by `/api/leads`'s JSON passthrough but never modeled on this list-level
   * type before (only `LeadDetailDto`, the single-lead detail shape, declared it) — same class of
   * "already in the real response, just never typed" gap as `AdSetSummaryDto.dailyBudget`'s own
   * doc. `undefined` for a lead Meta/Clara never attributed to a specific campaign.
   */
  readonly campaignId?: string;
}

/**
 * AAOS-CHAT-ROOM-CLARA — client-safe DTOs for the manager chat room (`/leads/[leadId]`), proxied
 * via this app's own `/api/leads/[leadId]/*` routes to `aaos-api`'s real `LeadsController`
 * endpoints. Same "plain hand-written interface, never import a backend DTO" convention as every
 * other type in this file.
 */
export interface LeadQualificationDto {
  readonly budget: boolean;
  readonly unit: boolean;
  readonly area: boolean;
  readonly payment: boolean;
  readonly timeline: boolean;
  readonly name: boolean;
}

export interface MessageDto {
  readonly id: string;
  readonly direction: string;
  readonly messageType: string;
  readonly body?: string;
  readonly sentAt?: string;
  readonly createdAt: string;
  /** Who authored an OUTGOING message — `"CLARA"` | `"SALES_HUMAN"` | `"MANAGER_INTERVENTION"` | `"JESSY"` (legacy read-only value, pre-agent-rename rows only — never written going forward), `undefined` for every INCOMING message (always the lead). */
  readonly senderType?: string;
  readonly senderName?: string;
}

export interface ConversationSummaryDto {
  readonly messageCount: number;
  readonly incomingCount: number;
  readonly outgoingCount: number;
  readonly currentStage: string;
  readonly lastIntent?: string;
  readonly status: string;
  readonly startedAt: string;
  readonly lastMessageAt: string;
}

export interface ScoringEventDto {
  readonly id: string;
  readonly leadId: string;
  readonly scoreBefore: number;
  readonly scoreAfter: number;
  readonly delta: number;
  readonly reason: string;
  readonly triggeredBy?: string;
  readonly createdAt: string;
}

/** One real tool call an agent action logged (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B) — mirrors `aaos-api`'s `ActivityToolCallDto`. */
export interface ActivityToolCallDto {
  readonly tool: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly at: string;
}

/**
 * One `agent_activities` row — the new Activity Log page's list item + detail-drawer shape
 * (design doc Phase B, mirrors `aaos-api`'s `ActivityResponseDto`). `status` is `"RUNNING" |
 * "SUCCESS" | "SIMULATED" | "ERROR"`, `mode` is `"DEV" | "LIVE"` — kept as plain `string` here,
 * same "server validates, dashboard trusts" convention `MessageDto.direction` already uses.
 */
export interface ActivityDto {
  readonly id: string;
  readonly loopId?: string;
  readonly agent: string;
  readonly actionType: string;
  readonly mode: string;
  readonly status: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly devPreview?: unknown;
  readonly reasoning?: string;
  readonly toolCalls: readonly ActivityToolCallDto[];
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly errorMessage?: string;
  readonly errorStack?: string;
  readonly createdAt: string;
}

/** `GET /api/activity-log` (dashboard proxy) — mirrors `aaos-api`'s `ActivityListResponseDto`. */
export interface ActivityListDto {
  readonly activities: readonly ActivityDto[];
  readonly total: number;
}

/**
 * `GET /api/leads/:leadId/messages` (dashboard proxy) — mirrors `aaos-api`'s
 * `MessagesPageResponseDto` (MENU RESTRUCTURE FINAL `/clara/inbox`). Paginated thread for one
 * lead's conversation, reusing the real `GET /api/v1/leads/:id/messages` endpoint the prior "Chat
 * Room Clara" task built — never a new `/conversations` namespace.
 */
export interface MessagesPageDto {
  readonly messages: readonly MessageDto[];
  readonly page: number;
  readonly limit: number;
  readonly total: number;
}

/** `GET /api/leads/:leadId` (dashboard proxy) — the full manager-facing lead detail, mirrors `aaos-api`'s `LeadDetailResponseDto`. */
export interface LeadDetailDto {
  readonly id: string;
  readonly leadPhone: string;
  readonly leadName?: string;
  readonly branchId: string;
  readonly campaignId?: string;
  readonly adId?: string;
  readonly status: string;
  readonly temperature: string;
  readonly score: number;
  readonly qualification: LeadQualificationDto;
  readonly assignedSalesId?: string;
  readonly assignedAt?: string;
  readonly firstMessageAt?: string;
  readonly lastMessageAt?: string;
  readonly becameHotAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly conversation?: ConversationSummaryDto;
  readonly messages: readonly MessageDto[];
}

/**
 * `GET /api/overview` (dashboard proxy) — client-safe DTOs mirroring `apps/aaos-api`'s real
 * `OverviewResponseDto` (AAOS Overview Monitor Phase O1,
 * `apps/aaos-api/src/modules/overview/dto/overview-response.dto.ts`) EXACTLY: same field names,
 * same optionality, same 3-agent (`SAMANTHA`/`KAI`/`CLARA`, no "Karen") roster. Hand-written per
 * this file's own top docstring — never imports the backend DTO file directly.
 *
 * `OverviewCampaignsSummaryDto.campaigns` is deliberately typed as this file's OWN
 * `CampaignSummaryDto[]` (not a new parallel type): the real `aaos-api` response actually sends the
 * richer `CampaignResponseDto`/`AdSetResponseDto`/`AdResponseDto` shapes (extra `metaId`/`funnel`/
 * `branch`/`createdAt` fields `CampaignSummaryDto`'s hierarchy doesn't model) — a strict superset,
 * so `CampaignSummaryDto` already describes every field this dashboard actually needs. This is what
 * lets the Overview page's campaign section hand the array straight to the already-built
 * `CampaignTable.tsx` with zero adapter/mapping code (see `OverviewMonitorClient.tsx`'s own
 * docstring for the fuller "why reuse `CampaignTable`" reasoning).
 */
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

export interface OverviewRecyclingSummaryDto {
  readonly sentToday: number;
  readonly respondedToday: number;
  readonly onCooldown: number;
}

export interface OverviewInsightPerAgentDto {
  readonly samantha: string;
  readonly kai: string;
  readonly clara: string;
}

/** Mirrors `DailyInsightResponseDto` — a discriminated union on `available`, same `LlmUnavailableResponseDto` shape (`reason`/`message`) every other real `llm` endpoint in this app can return. */
export type OverviewInsightDto =
  | {
      readonly available: true;
      readonly summary: string;
      readonly perAgent: OverviewInsightPerAgentDto;
    }
  | { readonly available: false; readonly reason: string; readonly message: string };

export interface OverviewResponseDto {
  readonly tenantId: string;
  readonly generatedAt: string;
  readonly leads?: OverviewLeadsSummaryDto;
  readonly campaigns?: OverviewCampaignsSummaryDto;
  readonly objective?: ObjectiveDto;
  /** Always exactly 3 entries (SAMANTHA/KAI/CLARA) — see this interface's own top docstring. */
  readonly agentStatus: readonly OverviewAgentScoreDto[];
  readonly recycling?: OverviewRecyclingSummaryDto;
  readonly activities: readonly ActivityDto[];
  readonly heatmap?: HeatmapResponseDto;
  readonly insight: OverviewInsightDto;
  /** Real, honest reason per FAILED section — a section not present here either succeeded or (for per-agent `agentStatus` entries) is reported inline via `undefined` score fields. */
  readonly errors: Readonly<Record<string, string>>;
}

/**
 * Client-safe mirror of `aaos-api`'s `ClosingResponseDto` (`GET /api/v1/closings`, proxied via
 * this app's own `/api/closings` route) — one test-drive/SPK/cancellation record from the real
 * `closings` Supabase table (`@aos/lead-store`'s `Closing` entity). Powers the Overview page's
 * KPI strip (Test Drive/SPK/Komisi Total counts) and "Closing Terbaru" list.
 */
export interface ClosingDto {
  readonly id: string;
  readonly leadId: string;
  readonly salesHumanId: string;
  readonly branchId: string;
  readonly closingType: "TEST_DRIVE" | "SPK" | "CANCELLED";
  readonly unitId?: string;
  readonly unitModel?: string;
  readonly unitPrice?: number;
  readonly commissionIdr?: number;
  readonly commissionPct?: number;
  readonly testDriveAt?: string;
  readonly spkAt?: string;
  readonly createdAt: string;
}

/**
 * `GET /api/clara/analytics?days=` (dashboard proxy) — mirrors `aaos-api`'s real
 * `LeadsAnalyticsResponseDto` (MENU RESTRUCTURE FINAL `/clara/analytics`). Every field is real,
 * computed server-side from `@aos/lead-store`'s `leads`/`conversations`/`messages` data — never
 * fabricated client-side math.
 */
export interface LeadsAnalyticsDailyPointDto {
  readonly date: string;
  readonly newContacts: number;
  readonly totalContacts: number;
}

export interface LeadsAnalyticsDto {
  readonly periodDays: number;
  readonly totalContacts: number;
  readonly newContacts: number;
  readonly active: number;
  readonly avgResponseTimeMinutes: number | null;
  readonly avgFirstResponseTimeMinutes: number | null;
  readonly dailySeries: readonly LeadsAnalyticsDailyPointDto[];
}

export interface ApiErrorBody {
  readonly error: { readonly code?: string; readonly message: string };
}

/**
 * `/api/llm/*` DTOs (AAOS-SAMANTHA-PAGES redesign) — client-safe mirrors of the `aaos-api` LLM
 * module's response shapes documented in `docs/PROMPT-AAOS-API-LLM-TAMARA.md` (built by a sibling
 * task; this app's `/api/llm/*` routes proxy to it). Kept as plain hand-written interfaces for the
 * same reason as every other DTO in this file — see this file's own top docstring.
 */
export interface LlmTemuanDto {
  readonly icon: string;
  readonly judul: string;
  readonly detail: string;
}

export interface LlmRekomendasiDto {
  readonly aksi: string;
  readonly target: string;
  readonly alasan: string;
  readonly estimasi: string;
}

export interface LlmAnalyzeResponseDto {
  readonly temuan: readonly LlmTemuanDto[];
  readonly rekomendasi: readonly LlmRekomendasiDto[];
  readonly ringkasan: string;
}

/** Client-safe mirror of `@aos/meta-ads-agent`'s `CreativeBrief` entity fields (coordinator note #4/#5) — plain strings, not the backend's `Branch`/`AdAngle` enums, matching this file's "never import a backend enum" convention. */
export interface LlmCreativeBriefResponseDto {
  readonly unit: string;
  readonly angle: string;
  readonly branch: string;
  readonly primaryMessage: string;
  readonly tone: string;
  readonly formats: readonly string[];
  readonly avoid: readonly string[];
  readonly urgency: string;
  readonly reason: string;
}

export interface LlmChatMessageDto {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface LlmChatResponseDto {
  readonly reply: string;
}

/**
 * AAOS-DASHBOARD-SIMULASI — client-safe mirrors of `aaos-api`'s new `modules/simulation` DTOs
 * (`GET/POST /api/v1/simulation/*`, proxied via this app's own `/api/simulation/*` routes). Same
 * "plain hand-written interface, never import a backend DTO" convention as this file's other
 * `Llm*Dto` types.
 */
export interface SimulationSamanthaStageDto {
  readonly available: boolean;
  readonly reason?: string;
  readonly temuan?: readonly LlmTemuanDto[];
  readonly rekomendasi?: readonly LlmRekomendasiDto[];
  readonly ringkasan?: string;
  readonly elapsedMs: number;
  readonly coverageScore: number;
  readonly audienceTargeting?: SimulationAudienceTargetingDto;
}

/**
 * One REAL Meta interest Samantha selected (AAOS-SIMULASI-TARGETING). Every value here — including
 * both audience-size bounds — is Meta's own, originally fetched by a live
 * `GET /search?type=adinterest` call and stored in `meta_interests`. The dashboard never computes,
 * rounds, or estimates an audience size.
 */
export interface SimulationSelectedInterestDto {
  readonly id: string;
  readonly name: string;
  readonly audienceSizeLower: number;
  readonly audienceSizeUpper: number;
  readonly topic?: string;
}

/**
 * The display-only "Campaign yang Akan Dibuat (Preview)" audience block. Mirrors aaos-api's
 * `AudienceTargetingPreview`.
 *
 * `geo`/`radiusKm`/`ageMin`/`ageMax` are an UNREVIEWED initial default derived from the branch's
 * real physical location — `geoNote` carries the Indonesian caveat and MUST be rendered alongside
 * them. `interests` are real Meta interests. Nothing in this block is ever sent to Meta: real
 * campaign creation (`/meta-ads/strategi`) constructs no targeting at all and is untouched by
 * this feature.
 */
export interface SimulationAudienceTargetingDto {
  readonly branch: string;
  readonly geo: readonly string[];
  readonly radiusKm: number;
  readonly ageMin: number;
  readonly ageMax: number;
  readonly geoNote: string;
  readonly candidateCount: number;
  readonly interests: readonly SimulationSelectedInterestDto[];
  readonly reasoning?: string;
  readonly interestsUnavailableReason?: string;
}

export interface SimulationKaiBriefDto {
  readonly unit: string;
  readonly angle: string;
  readonly branch: string;
  readonly primaryMessage: string;
  readonly tone: string;
  readonly formats: readonly string[];
  readonly avoid: readonly string[];
  readonly urgency: string;
}

/** One real Kie AI copy variant — mirrors aaos-api's `KaiPromptCopyVariant`, itself `@aos/creative-agent`'s `CopyBuilder.buildVariants` output verbatim. */
export interface SimulationKaiCopyVariantDto {
  readonly id: string;
  readonly variantLabel: string;
  readonly primaryText: string;
  readonly headline: string;
  readonly callToAction: string;
}

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 3, section C — mirrors aaos-api's `KaiPromptDetail`.
 * Every field is the real prompt/format/copy decision the real Kai pipeline (`FormatDecisionService`
 * + `PromptBuildingService`/`AutomotivePromptBuilder` + `CopyBuilder`) would produce for this exact
 * brief, computed WITHOUT calling Kie AI (no credits spent, no real generation triggered).
 */
export interface SimulationKaiPromptDetailDto {
  readonly videoPrompt?: string;
  readonly imagePrompts: readonly string[];
  readonly copyVariants: readonly SimulationKaiCopyVariantDto[];
  readonly copyVariantsUnavailableReason?: string;
  readonly sourcePhotoUrls: readonly string[];
  readonly format: string;
  readonly imageModel: string;
  readonly imageAspectRatio: string;
  readonly imageCount: number;
  readonly videoModel?: string;
  readonly videoDurationSeconds?: number;
  readonly videoAspectRatio?: string;
}

export interface SimulationKaiStageDto {
  readonly available: boolean;
  readonly reason?: string;
  readonly brief?: SimulationKaiBriefDto;
  readonly elapsedMs: number;
  readonly videoGenerated: false;
  readonly note: string;
  /** `undefined` when the prompt-detail computation itself degraded — see `KaiStageResult.promptDetail`'s backend doc. Never fabricated when absent. */
  readonly promptDetail?: SimulationKaiPromptDetailDto;
}

export interface SimulationClaraPersonaRunDto {
  readonly personaId: string;
  readonly ok: boolean;
  readonly error?: string;
  readonly finalScore?: number;
  readonly finalTemperature?: string;
  readonly handoffTriggered?: boolean;
  readonly totalTurns?: number;
  readonly overallScore?: number;
  readonly grade?: string;
  readonly verdict?: string;
  readonly feedbackItems?: ReadonlyArray<{ readonly dimension: string; readonly message: string }>;
}

export interface SimulationClaraStageDto {
  readonly available: boolean;
  readonly reason?: string;
  readonly runs: readonly SimulationClaraPersonaRunDto[];
  readonly elapsedMs: number;
}

export interface SimulationScoringDto {
  readonly samanthaCoverageScore: number;
  readonly kaiScore: number;
  readonly claraScore: number;
  readonly overallScore: number;
  readonly grade: "A" | "B" | "C" | "D" | "F";
  readonly verdict: "GO" | "CONDITIONAL" | "NO-GO" | "INCOMPLETE";
}

export interface SimulationResultDto {
  readonly samantha: SimulationSamanthaStageDto;
  readonly kai: SimulationKaiStageDto;
  readonly clara: SimulationClaraStageDto;
  readonly scoring: SimulationScoringDto;
}

export interface SimulationLogEntryDto {
  readonly step: string;
  readonly level: string;
  readonly message: string;
  /**
   * Real structured data attached to a log line (`simulation_logs.payload`). Only the audience-
   * targeting step writes it today — every other line omits it, so the log panel's "Lihat data"
   * toggle appears only where there is genuinely something to show.
   */
  readonly payload?: Record<string, unknown>;
  readonly createdAt: string;
}

export interface SimulationStatusDto {
  readonly id: string;
  readonly status: "RUNNING" | "DONE" | "ERROR" | "LIVE" | "ROLLED_BACK";
  readonly currentStep: string;
  readonly campaignDataSource: "cache" | "fresh";
  readonly personaIds: readonly string[];
  readonly branch?: string;
  readonly result?: SimulationResultDto;
  readonly errorMessage?: string;
  readonly decision?: "APPROVED" | "REJECTED";
  readonly decidedBy?: string;
  readonly decisionNotes?: string;
  readonly decidedAt?: string;
  /** AAOS-GO-LIVE (Phase 4) additions — present only once `status` is `'LIVE'` or `'ROLLED_BACK'`. Mirrors aaos-api's `SimulationStatusResponseDto`. */
  readonly liveCampaignId?: string;
  readonly liveAdId?: string;
  readonly liveAt?: string;
  readonly rolledBackAt?: string;
  readonly logs: readonly SimulationLogEntryDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SimulationHistoryEntryDto {
  readonly id: string;
  readonly status: "RUNNING" | "DONE" | "ERROR" | "LIVE" | "ROLLED_BACK";
  readonly overallScore?: number;
  readonly grade?: string;
  readonly verdict?: string;
  readonly decision?: "APPROVED" | "REJECTED";
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Client-safe mirror of `apps/aaos-simulator`'s `POST /api/simulate` response (proxied via this
 * app's own `/api/simulator-run` route) — used by Step 4's standalone "coba satu persona" preview,
 * independent of the full orchestrated `/api/simulation/*` pipeline. Prefixed `Clara*` (not
 * `Simulation*`) to avoid clashing with the `Simulation*Dto` family above, which describes THIS
 * app's own `aaos-api`-backed pipeline record, not `aaos-simulator`'s raw response.
 */
export interface ClaraSimulationRunDto {
  readonly finalScore: number;
  readonly finalTemperature: string;
  readonly handoffTriggered: boolean;
  readonly totalTurns: number;
  readonly overallScore: number;
  readonly grade: string;
  readonly verdict: string;
  readonly feedbackItems: ReadonlyArray<{ readonly dimension: string; readonly message: string }>;
}

/**
 * AAOS-SCRAPER-ASSET-LIBRARY — client-safe mirrors of the new `aaos-api` `/api/v1/scraper/*` and
 * `/api/v1/assets/*` response DTOs, reached exclusively through this app's own server-only
 * `/api/scraper/*` / `/api/assets/*` proxy routes (a `"use client"` component must NEVER call
 * `aaos-api` directly — see `src/lib/api.ts`'s module doc).
 *
 * Deliberately NO `width`/`height`/`durationSeconds`/`isMainPhoto`/`usedInPackages`/`source` fields:
 * nothing in the backend produces any of them, so the UI omits them rather than rendering a
 * fabricated value.
 */
export type AssetTypeDto =
  "UNIT_PHOTO" | "BRAND" | "TESTIMONIAL" | "AI_VIDEO" | "AI_IMAGE" | "OVERLAY";

/** The real `AssetStatus` union — there is no `REJECTED` state anywhere in this domain. */
export type AssetStatusDto = "ACTIVE" | "ARCHIVED" | "PENDING";

export interface AssetDto {
  readonly id: string;
  readonly type: AssetTypeDto;
  readonly status: AssetStatusDto;
  readonly storagePath: string;
  readonly publicUrl: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly tags: readonly string[];
  readonly unitId?: string;
  readonly unitModel?: string;
  readonly unitYear?: number;
  readonly branch?: string;
  readonly aiPrompt?: string;
  readonly aiModel?: string;
  readonly creativeBriefId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AssetListDto {
  readonly assets: readonly AssetDto[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export interface AssetStatsDto {
  readonly totalAssets: number;
  readonly byType: Readonly<Record<string, number>>;
  readonly byBranch: Readonly<Record<string, number>>;
  readonly byStatus: Readonly<Record<string, number>>;
  readonly totalSizeBytes: number;
  /**
   * CREATIVE HUB — the real, honest "Manual/Upload" vs "Kai" split. Derived server-side from
   * whether `ai_model` is set on the row (only `SaveAiCreative`, Kai's real generation use case,
   * ever sets it) — NOT from `type`, which a manual upload can also set to `AI_IMAGE`/`AI_VIDEO`.
   */
  readonly bySource: Readonly<{ MANUAL: number; KAI: number }>;
}

export interface AssetDownloadDto {
  readonly url: string;
  readonly expiresInSeconds: number;
}

export interface ScrapedUnitDto {
  readonly unitId: string;
  readonly url: string;
  readonly brand: string;
  readonly model: string;
  readonly year: number;
  readonly transmission: "AT" | "MT";
  readonly color: string;
  readonly kilometer: number;
  readonly priceIdr: number;
  readonly branch: string;
  /** SOURCE listing photo URLs. The GCS-stored copies are assets — fetched via `/api/assets?unitId=`. */
  readonly photos: readonly string[];
  readonly photoCount: number;
  readonly available: boolean;
  readonly scrapedAt: string;
}

export interface StockListDto {
  readonly units: readonly ScrapedUnitDto[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export interface ScrapeJobResultDto {
  readonly unitsScraped: number;
  readonly newUnits: number;
  readonly soldUnits: number;
  readonly photosStored: number;
  readonly photosFailed: number;
  readonly unitsPersisted?: number;
  readonly unitId?: string;
}

export interface ScrapeJobLogEntryDto {
  readonly level: "INFO" | "WARN" | "ERROR";
  readonly message: string;
  readonly createdAt: string;
}

export interface ScrapeJobDto {
  readonly id: string;
  readonly kind: "FULL" | "UNIT";
  readonly status: "RUNNING" | "DONE" | "ERROR";
  readonly unitUrl?: string;
  readonly branch?: string;
  readonly progressCurrent: number;
  /** Absent until the listing has really been parsed — the progress bar stays indeterminate until then. */
  readonly progressTotal?: number;
  readonly result?: ScrapeJobResultDto;
  readonly errorMessage?: string;
  readonly logs: readonly ScrapeJobLogEntryDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ScraperStatusDto {
  readonly totalUnits: number;
  readonly availableUnits: number;
  readonly totalPhotos: number;
  readonly byBranch: Readonly<Record<string, number>>;
  /** Absent when nothing has ever been scraped — never a fabricated timestamp. */
  readonly lastScrapedAt?: string;
  readonly lastJob?: ScrapeJobDto;
}

export interface RunScrapeResponseDto {
  readonly jobId: string;
  readonly status: "RUNNING";
  readonly kind: "FULL" | "UNIT";
}

/**
 * `/api/calendar*` DTOs (AAOS-KALENDER-AKTIVITAS) — client-safe mirror of `aaos-api`'s
 * `CalendarEventResponseDto`. `eventType` is deliberately `string`, not a literal union: only the
 * 5 supported types are ever offered by "Tambah Jadwal" (see `CALENDAR_EVENT_TYPE_OPTIONS` in
 * `components/calendar/calendar.types.ts`), but a row this app merely displays should not fail to
 * typecheck if the backend ever adds a 6th.
 */
export interface CalendarEventResultDto {
  readonly summary: string;
  readonly [key: string]: unknown;
}

export interface CalendarEventDto {
  readonly id: string;
  readonly eventType: string;
  readonly title: string;
  readonly description?: string;
  readonly scheduledAt: string;
  readonly timezone: string;
  readonly recurrence: string;
  readonly recurrenceDays?: readonly number[];
  readonly recurrenceTime?: string;
  readonly status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED";
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly targetId?: string;
  readonly targetName?: string;
  readonly metadata?: Record<string, unknown>;
  readonly result?: CalendarEventResultDto;
  readonly errorMessage?: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

/**
 * `/api/recycling*` DTOs (AAOS-LEAD-RECYCLING-BROADCAST) — client-safe mirrors of `aaos-api`'s
 * real `recycling` module response DTOs. Powers `/clara/recycling`'s 3 tabs.
 */
export interface RecyclingPoolLeadDto {
  readonly id: string;
  readonly leadName?: string;
  readonly leadPhone: string;
  readonly branchId: string;
  readonly status: string;
  readonly score: number;
  readonly temperature: string;
  readonly lastMessageAt?: string;
  readonly broadcastCount: number;
  readonly lastBroadcastAt?: string;
  readonly lastBroadcastTemplateId?: string;
  readonly readyToSend: boolean;
}

export interface TemplateDto {
  readonly id: string;
  readonly name: string;
  readonly content: string;
  readonly targetStatuses: readonly string[];
  readonly cooldownDays: number;
  readonly status: string;
  readonly replyRate: number;
  readonly hotRate: number;
  readonly sentCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateTemplateInput {
  readonly name: string;
  readonly content: string;
  readonly targetStatuses: readonly string[];
  readonly cooldownDays: number;
  readonly status: "ACTIVE" | "DRAFT" | "INACTIVE";
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>;

export interface BroadcastLogDto {
  readonly id: string;
  readonly leadId: string;
  readonly templateId?: string;
  readonly messageSent: string;
  readonly status: string;
  readonly sentAt: string;
  readonly deliveredAt?: string;
  readonly readAt?: string;
  readonly replied: boolean;
  readonly repliedAt?: string;
  readonly convertedToHot: boolean;
  readonly convertedAt?: string;
}

export interface BroadcastResultDto {
  readonly leadId: string;
  readonly templateId: string;
  readonly broadcastLogId: string;
  readonly sentAt: string;
}

export interface BroadcastAllResultDto {
  readonly attempted: number;
  readonly sent: readonly BroadcastResultDto[];
  readonly failed: ReadonlyArray<{ readonly leadId: string; readonly reason: string }>;
}

export interface AutoModeDto {
  readonly autoMode: boolean;
}

/**
 * `/api/abtesting*` DTOs (AAOS-ABTESTING-LOOKALIKE) — client-safe mirrors of `aaos-api`'s real
 * `abtesting` module response DTOs. Powers `/meta-ads/abtesting`'s tabs + create-test modal.
 */
export interface AbTestVariantDto {
  readonly id: string;
  readonly variantLabel: string;
  readonly angle: string;
  readonly creativePackageId: string;
  readonly metaAdId?: string;
  readonly status: string;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly conversations: number;
  readonly leads: number;
  readonly rphLead?: number;
  readonly ctr?: number;
  readonly lastSyncedAt?: string;
  /**
   * Real, best-effort creative thumbnail (user-reported gap: "di creative ab testing asset
   * image/video gabisa di render") — resolved server-side from this variant's own real
   * `creativePackageId` (`aaos-api`'s `AbTestingService.getVariantsMedia`, the SAME real
   * `creative_packages.videoUrl`/`imageUrls` the Meta ad itself was created from). `undefined` when
   * the package was deleted or genuinely has no media yet — never a fabricated placeholder URL.
   */
  readonly imageUrl?: string;
  readonly videoUrl?: string;
  readonly assetKind?: "IMAGE" | "VIDEO";
  /** Real copy text (`creative_packages.copyVariants[0]`) — `undefined` when the package has no copy yet. */
  readonly primaryText?: string;
  readonly headline?: string;
}

export interface AbTestDto {
  readonly id: string;
  readonly name: string;
  readonly campaignId: string;
  readonly adSetId: string;
  readonly status: string;
  readonly thresholdSpend: number;
  readonly thresholdDays: number;
  readonly minMarginPct: number;
  readonly autoPauseLoser: boolean;
  readonly autoScaleWinner: boolean;
  readonly winnerVariantId?: string;
  readonly winnerRphLead?: number;
  readonly improvementPct?: number;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly failedReason?: string;
  readonly createdAt: string;
  readonly variants: readonly AbTestVariantDto[];
}

export interface CreateAbTestInput {
  readonly name: string;
  readonly campaignId: string;
  readonly adSetId: string;
  readonly pageId: string;
  readonly waLink: string;
  readonly mode: "AUTO";
  readonly variantCount: 2 | 3;
  readonly unit: string;
  readonly unitModel?: string;
  readonly branch: string;
  readonly targetPersona?: string;
  readonly primaryMessage: string;
  readonly format: "VIDEO_AND_IMAGES" | "IMAGES_ONLY";
  readonly urgency?: "HIGH" | "MEDIUM" | "LOW";
  readonly thresholdSpend: number;
  readonly thresholdDays: number;
  readonly minMarginPct: number;
  readonly autoPauseLoser: boolean;
  readonly autoScaleWinner: boolean;
}

/**
 * `/api/lookalike*` DTOs (AAOS-ABTESTING-LOOKALIKE Part 2) — client-safe mirrors of `aaos-api`'s
 * real `lookalike` module response DTOs. Powers `/meta-ads/lookalike`'s status card + audience
 * list + "Buat Lookalike N%" buttons.
 */
export interface MetaAudienceDto {
  readonly id: string;
  readonly metaAudienceId: string;
  readonly audienceType: string;
  readonly name: string;
  readonly size?: number;
  readonly originAudienceId?: string;
  readonly percentage?: number;
  readonly status: string;
  readonly lastUpdatedAt?: string;
  readonly createdAt: string;
}

export interface LookalikeStatusDto {
  readonly totalHotLeads: number;
  readonly syncedToMetaAudience: number;
  readonly minRequiredForLookalike: number;
  readonly progressPercentage: number;
  readonly lookalikeEligible: boolean;
  readonly lastSyncedAt?: string;
  readonly customAudience?: MetaAudienceDto;
}

export interface LookalikeSyncResultDto {
  readonly summary: string;
  readonly newlySynced: number;
  readonly totalSynced: number;
  readonly customAudience?: MetaAudienceDto;
}

/**
 * `/api/intelligence*` + `/api/competitors*` DTOs (AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 5) —
 * client-safe mirrors of `aaos-api`'s real `intelligence` module response DTOs. Powers the
 * Strategi page's "Intelligence Signals" card + Settings' competitor-pages management.
 *
 * `IntelligenceSignalsResponseDto`'s real backend type (`apps/aaos-api/src/modules/intelligence/
 * dto/intelligence.dto.ts`) types `seasonal`/`trends`/`competitor`/`inventory`/`leadProfile`/
 * `closing` as `unknown` — but `IntelligenceService.refresh()`'s `buildXContext` methods always
 * write exactly the shape each `*ContextSchema` below mirrors (confirmed by direct read of
 * `apps/aaos-api/src/modules/llm/dto/campaign-strategy.dto.ts`'s Zod schemas, the same shape those
 * builder methods return), so these are typed here rather than left as `unknown` — never a
 * fabricated field beyond what those schemas define.
 */
export interface SeasonalSignalDto {
  readonly isSpecialPeriod: boolean;
  readonly eventName?: string;
  readonly budgetMultiplier?: number;
  readonly upcomingEvent?: string;
  readonly daysUntil?: number;
  readonly recommendedAngles?: readonly string[];
  readonly reasoning: string;
}

export interface TrendsSignalDto {
  readonly available: boolean;
  readonly shouldScaleBudget?: boolean;
  readonly suggestedAngle?: string;
  readonly risingKeywords?: readonly string[];
  readonly reasoning: string;
}

export interface CompetitorSignalDto {
  readonly available: boolean;
  readonly saturatedAngles?: readonly string[];
  readonly unusedAngles?: readonly string[];
  readonly topCompetitorAngle?: string;
  readonly reasoning: string;
}

export interface InventorySignalDto {
  readonly available: boolean;
  readonly hasNewArrivals?: boolean;
  readonly newArrivalItems?: readonly string[];
  readonly recommendedAngle?: string;
  readonly reasoning: string;
}

export interface LeadProfileSignalDto {
  readonly totalLeads: number;
  readonly avgScore: number;
  readonly topBranches: ReadonlyArray<{ readonly branchId: string; readonly count: number }>;
  readonly peakHour?: number;
  readonly peakDay?: number;
}

export interface ClosingSignalDto {
  readonly totalEvents: number;
  readonly topUnitModels: ReadonlyArray<{
    readonly unitModel: string;
    readonly spkCount: number;
    readonly closingRate: number;
  }>;
  readonly slowUnitModels: ReadonlyArray<{
    readonly unitModel: string;
    readonly closingRate: number;
  }>;
}

/** `LlmUnavailableResponseDto` union member — same "AI tidak tersedia" shape every LLM-backed endpoint in this app can return. */
export interface CampaignStrategyUnavailableDto {
  readonly available: false;
  readonly reason: "NO_API_KEY" | "RATE_LIMITED" | "PROVIDER_ERROR" | "INVALID_RESPONSE";
  readonly message: string;
}

export interface CampaignStrategyAvailableDto {
  readonly available: true;
  readonly campaignMode: "BRAND" | "PRODUCT" | "BOTH";
  readonly reasoning: string;
  readonly brandCampaign?: {
    readonly angle: string;
    readonly copy: string;
    readonly objective: string;
    readonly budgetPct: number;
    readonly reasoning: string;
  };
  readonly productCampaign?: {
    readonly angle: string;
    readonly targetUnit: string;
    readonly copy: string;
    readonly objective: string;
    readonly budgetPct: number;
    readonly reasoning: string;
  };
  readonly budgetRecommendation: {
    readonly action: "SCALE" | "REDUCE" | "MAINTAIN";
    readonly multiplier: number;
    readonly reasoning: string;
  };
  readonly summary: string;
  readonly urgency: "HIGH" | "MEDIUM" | "LOW";
}

export type CampaignStrategyDto = CampaignStrategyAvailableDto | CampaignStrategyUnavailableDto;

/**
 * AAOS-META-MCP-BONUS-TOOLS (Tool 4 — "CAPI Health") — real `EmqReport`-backed shape from
 * `apps/aaos-api`'s `IntelligenceService.buildCapiHealthContext`. Deliberately renders ONLY what
 * the real `EmqReport` entity has (`pixelId`/`score`/`eventsReceived`/`capturedAt`) — no
 * per-event-type breakdown or issues list (neither exists on the real entity).
 */
export type CapiHealthSignalDto =
  | {
      readonly available: true;
      readonly pixelId: string;
      readonly score: number;
      readonly eventsReceived: number;
      readonly capturedAt: string;
      readonly reasoning: string;
    }
  | { readonly available: false; readonly reasoning: string };

/**
 * AAOS-META-MCP-BONUS-TOOLS (Tool 1 — "Anomaly Signal", honestly scoped down) — real
 * `FREQUENCY_HIGH`-only anomalies from `IntelligenceService.buildAnomalyContext`. Every other
 * anomaly type from the original spec is deferred (no historical persistence exists to compute
 * them honestly) — see `@aos/meta-ads-agent`'s `AnomalyDetector` docstring.
 */
export interface AnomalySignalDto {
  readonly adId: string;
  readonly adName: string;
  readonly anomalyType: "FREQUENCY_HIGH";
  readonly severity: "HIGH" | "MEDIUM";
  readonly frequency: number;
  readonly message: string;
}

export interface AnomalySignalsDto {
  readonly available: true;
  readonly anomalies: readonly AnomalySignalDto[];
  readonly reasoning: string;
}

export interface IntelligenceSignalsDto {
  readonly id: string;
  readonly branchId: string | null;
  readonly seasonal: SeasonalSignalDto;
  readonly trends: TrendsSignalDto;
  readonly competitor: CompetitorSignalDto;
  readonly inventory: InventorySignalDto;
  readonly leadProfile: LeadProfileSignalDto;
  readonly closing: ClosingSignalDto;
  readonly capiHealth: CapiHealthSignalDto;
  readonly anomalies: AnomalySignalsDto;
  readonly campaignStrategy?: CampaignStrategyDto;
  readonly digestText: string | null;
  readonly generatedAt: string;
}

export interface CompetitorPageDto {
  readonly id: string;
  readonly name: string;
  readonly pageId: string;
  readonly vertical: string;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface CreateCompetitorPageInput {
  readonly name: string;
  readonly pageId: string;
  readonly vertical: "AUTOMOTIVE" | "PROPERTY";
  readonly active: boolean;
}
