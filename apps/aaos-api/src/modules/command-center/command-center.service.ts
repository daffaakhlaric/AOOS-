import { Injectable, Logger } from "@nestjs/common";

import { AbTestVariantRepository } from "../abtesting/infrastructure/ab-test-variant.repository.js";
import { CampaignHealthService } from "../campaign-health/campaign-health.service.js";
import type { CampaignHealthResponseDto } from "../campaign-health/dto/campaign-health-response.dto.js";
import { CreativeMemoryService } from "../creative-memory/creative-memory.service.js";
import type { AnglePerformanceResult } from "../creative-memory/domain/angle-performance.js";
import { ResponseCache } from "../llm/cache/ResponseCache.js";
import type { CampaignResponseDto } from "../meta-ads/dto/campaign-response.dto.js";
import { MetaAdsService } from "../meta-ads/meta-ads.service.js";
import {
  detectCreativeWinnerOpportunities,
  detectScalingOpportunity,
  type Opportunity,
} from "../opportunities/domain/opportunity.js";

import {
  selectRepresentativeCreative,
  type RepresentativeCreativeCandidate,
  type RepresentativeCreativeSelection,
} from "./domain/representative-creative.js";
import type {
  AccountSummaryResponseDto,
  CampaignHealthSummaryEntryDto,
  CampaignTrendDto,
  CampaignTrendMetric,
  RepresentativeCreativeDto,
} from "./dto/account-summary-response.dto.js";

/**
 * Real Meta `datePreset` for this endpoint's own account-wide campaign enumeration — reuses
 * `OverviewService.getCampaignsSummary`'s own `"last_7d"` convention (a closer real proxy for
 * "recent/active" than the campaigns endpoint's own `last_30d` default). Only used to discover
 * WHICH campaigns are real+`ACTIVE` and their real name/spend for display — `assess()` below
 * always computes `health`/`diagnosis`/`decision` over ITS OWN fixed `last_7_days`/
 * `previous_7_days`/`lifetime` windows regardless of this value.
 */
const ACCOUNT_SUMMARY_DATE_PRESET = "last_7d" as const;

/**
 * Sane cap on how many real active campaigns this one request will run `CampaignHealthService
 * .assess()` over. `assess()` is cheap (in-memory, non-LLM, deterministic) but still performs 4
 * real `meta_insights_daily` reads per call — an account with a pathological number of active
 * campaigns (hundreds) could otherwise make this one request hang. Documented, honest cap (never
 * silently truncated without saying so — see `AccountSummaryResponseDto.campaignsCapped`).
 */
export const MAX_CAMPAIGNS_ANALYZED = 100;

/**
 * REAL BUG FIX (observed live, 2026-09-21): this endpoint was exhausting the real Meta Ads
 * connector's own 200-calls/hour `TokenBucketRateLimiter` budget, after which
 * `enumerateActiveCampaigns` failed with "Local rate-limit budget exhausted (200 calls/hour)" and
 * the whole Command Center honestly-but-uselessly reported zero campaigns ("datanya jadi ilang").
 *
 * Cause: `getAdAccounts` + `pullCampaigns` (a full campaign/ad-set/ad tree pull, many real Meta
 * calls per invocation) ran on EVERY request — and the Command Center page also loads
 * `GET /api/v1/overview`, which performs its OWN independent tree pull, so a single page view cost
 * two full pulls and every refresh cost two more. A handful of refreshes drains the hourly budget.
 *
 * Fix: a short TTL cache keyed by tenant, reusing this codebase's existing `ResponseCache<T>`
 * (`modules/llm/cache/ResponseCache.ts`) rather than a second, parallel cache implementation.
 * Repeated page loads/refreshes inside the window now cost ZERO Meta calls. 5 minutes is
 * deliberately short: `CampaignHealthService.assess` is deterministic over `meta_insights_daily`
 * rows that only change when the real Meta sync cron writes new ones, so a 5-minute-stale Command
 * Center is honest, while still collapsing a refresh storm into one real pull.
 *
 * A FAILED pull is never cached (see `getAccountSummary`) — otherwise one rate-limited moment would
 * pin an empty summary in place for the whole window.
 */
const ACCOUNT_SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Samantha Attention Queue row mini sparkline — how many real days of `meta_insights_daily` history
 * one row's series covers. 7 matches `CampaignHistoryQuerySchema`'s own default and the
 * `last_7_days` window `CampaignHealthService.assess` already diagnoses over, so the sparkline shows
 * the SAME period the row's diagnosis and its `baselineValue -> currentValue` deltas are about.
 */
const TREND_DAYS = 7;

/**
 * Cap on how many rows this one response fetches a real daily series for. The Decision Queue renders
 * at most 6 rows and `useDecisionQueue` caps its own list at 5, so 12 covers every row any tab can
 * show with room to spare, while bounding an account with 100 analyzed campaigns to 12 small DB
 * reads instead of 100. Candidates are picked by the SAME real impact-then-confidence ranking the
 * queue itself sorts by, so the capped set is exactly the rows most likely to be on screen.
 *
 * These are `meta_insights_daily` reads (Postgres), NOT Meta Ads API calls — this adds ZERO calls to
 * the real 200-calls/hour budget this endpoint's cache exists to protect.
 */
export const MAX_CAMPAIGNS_WITH_TREND = 12;

/** Same real impact ranking `useDecisionQueue` (eyvra-dashboard-v2) sorts the queue by. */
const IMPACT_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };

/**
 * The real `SamanthaSignalType` root cause -> the real `meta_insights_daily` column that root cause
 * is ABOUT. Every mapping here is the metric the signal engine itself measured to raise that signal
 * (`modules/metric-snapshot/domain/signal-engine.ts`).
 *
 * `SPEND_WITHOUT_RESULT` and `INSUFFICIENT_DATA` are deliberately ABSENT: neither is about a single
 * one of these three series (the former is about spend-vs-leads, the latter about the absence of
 * data), so those rows get no sparkline rather than an arbitrarily-chosen one.
 */
const TREND_METRIC_BY_ROOT_CAUSE: Readonly<Record<string, CampaignTrendMetric>> = {
  CTR_DROP: "ctr",
  CTR_IMPROVEMENT: "ctr",
  CPL_SPIKE: "cpl",
  CPL_IMPROVEMENT: "cpl",
  FREQUENCY_RISE: "frequency",
  CREATIVE_FATIGUE: "frequency",
};

/**
 * `modules/command-center` — EYVRA Samantha V2 Command Center real-data-wiring fix. The ONE real,
 * account-wide aggregate the Command Center page's Needs Attention / Opportunities / Samantha
 * Decision Queue sections need, replacing their previous reliance on the legacy per-ad `Verdict`
 * aggregation (`computeCampaignVerdicts`/`CampaignVerdictRow`) with the REAL Samantha V2 domain
 * model this codebase already built (`CampaignHealth`/`CampaignDiagnosis`/`SamanthaDecision`/
 * `Opportunity`) but the Command Center page never actually consumed end-to-end.
 *
 * Composes, in ONE server-side call:
 *  1. `MetaAdsService.getAdAccounts` + `MetaAdsService.pullCampaigns` — the SAME real campaign
 *     enumeration `OverviewService.getCampaignsSummary` already performs (reused verbatim as a
 *     pattern; no second, parallel Meta-pulling implementation).
 *  2. `CampaignHealthService.assess(tenantId, campaign.metaId)` for every real `ACTIVE` campaign
 *     (capped, see `MAX_CAMPAIGNS_ANALYZED`) — the SAME real, already-live per-campaign endpoint
 *     logic, reused verbatim, never duplicated.
 *  3. `detectScalingOpportunity(campaignId, decision)` (`opportunities/domain/opportunity.ts`,
 *     reused verbatim) over every real per-campaign `decision` just computed.
 *  4. `CreativeMemoryService.getAnglePerformance(tenantId)` ONCE, account-wide, then
 *     `detectCreativeWinnerOpportunities(angles)` (also reused verbatim) over the real result.
 *
 * Lives in its own module (not folded into `campaign-health`/`opportunities`/`overview`) because
 * it is a genuine composition ACROSS those three real services/domains with no natural single
 * owner among them — same "a cross-cutting aggregate gets its own thin module" precedent
 * `OverviewModule` itself already establishes one layer up (composing leads/campaigns/objective/
 * activity-log/etc.).
 */
@Injectable()
export class CommandCenterService {
  private readonly logger = new Logger(CommandCenterService.name);

  /** See `ACCOUNT_SUMMARY_CACHE_TTL_MS` for the real Meta rate-limit exhaustion this prevents. */
  private readonly cache = new ResponseCache<AccountSummaryResponseDto>(
    ACCOUNT_SUMMARY_CACHE_TTL_MS,
  );

  constructor(
    private readonly metaAdsService: MetaAdsService,
    private readonly campaignHealthService: CampaignHealthService,
    private readonly creativeMemoryService: CreativeMemoryService,
    /**
     * AAOS Command Center creative thumbnails — read ONLY for the real, per-Meta-ad A/B-test
     * outcome (`ab_test_variants.status === "WINNER"`) that badges a row's representative creative.
     * Appended at the END of the constructor so every pre-existing 3-arg instantiation keeps
     * compiling; `undefined` (a tenant with no A/B tests, or a test/spec that doesn't supply it)
     * degrades honestly to Samantha's `SCALE` verdict as the only winner signal.
     */
    private readonly abTestVariants?: AbTestVariantRepository,
  ) {}

  async getAccountSummary(
    tenantId: string,
    correlationId: string,
  ): Promise<AccountSummaryResponseDto> {
    const cached = this.cache.get("account-summary", { tenantId });
    if (cached !== undefined) {
      return cached;
    }

    const errors: Record<string, string> = {};

    const activeCampaigns = await this.enumerateActiveCampaigns(tenantId, correlationId, errors);
    const campaignsCapped = activeCampaigns.length > MAX_CAMPAIGNS_ANALYZED;
    const toAnalyze = campaignsCapped
      ? activeCampaigns.slice(0, MAX_CAMPAIGNS_ANALYZED)
      : activeCampaigns;

    const [campaignEntries, angles] = await Promise.all([
      this.assessCampaigns(tenantId, toAnalyze, errors),
      this.getAngles(tenantId, errors),
    ]);

    // Representative-creative resolution runs INSIDE this cached path (see
    // `ACCOUNT_SUMMARY_CACHE_TTL_MS`) and over the ads the campaign pull ALREADY returned — no
    // second campaign-tree pull, so a repeated page load inside the TTL window costs zero extra
    // Meta calls. Never throws: a failure leaves every row on its existing placeholder.
    const withCreatives = await this.attachRepresentativeCreatives(
      tenantId,
      toAnalyze,
      campaignEntries,
      errors,
    );

    // Samantha Attention Queue row mini sparkline — also INSIDE this cached path, and a pure
    // `meta_insights_daily` (Postgres) read, so a repeated page load inside the TTL window costs
    // nothing at all and NO Meta Ads API call is added at any point. Never throws: a row whose
    // history read fails simply carries no `trend` and renders without a sparkline.
    const withTrends = await this.attachTrends(tenantId, withCreatives, errors);

    const scalingOpportunities: Opportunity[] = [];
    for (const entry of withTrends) {
      const opportunity = detectScalingOpportunity(entry.campaignId, entry.decision);
      if (opportunity !== undefined) {
        scalingOpportunities.push(opportunity);
      }
    }
    const creativeWinnerOpportunities = detectCreativeWinnerOpportunities(angles);

    const response: AccountSummaryResponseDto = {
      tenantId,
      generatedAt: new Date().toISOString(),
      campaignsAnalyzed: withTrends.length,
      campaignsCapped,
      campaigns: withTrends,
      opportunities: [...scalingOpportunities, ...creativeWinnerOpportunities],
      errors,
    };

    // Only a SUCCESSFUL campaign enumeration is cached. Caching a rate-limited/failed pull would
    // pin an empty Command Center in place for the whole TTL window — the exact failure this cache
    // exists to prevent (see ACCOUNT_SUMMARY_CACHE_TTL_MS's own doc).
    if (errors["campaigns"] === undefined) {
      this.cache.set("account-summary", { tenantId }, response);
    }

    return response;
  }

  /**
   * SAME real, multi-ad-account campaign enumeration `OverviewService.getCampaignsSummary`
   * performs (see that method's own doc for the real bug it fixed: aggregating across EVERY
   * configured ad account, not just the connector's first one) — reused as a pattern here rather
   * than imported directly, since `OverviewService` does not export this as a standalone method.
   * A failed pull is recorded honestly under `errors["campaigns"]` and returns `[]`, never throws
   * (matching `OverviewService.safeFetch`'s own partial-failure discipline) — this endpoint's
   * other sections (creative-memory opportunities) should still be able to return something real.
   */
  private async enumerateActiveCampaigns(
    tenantId: string,
    correlationId: string,
    errors: Record<string, string>,
  ): Promise<readonly CampaignResponseDto[]> {
    try {
      const accounts = await this.metaAdsService.getAdAccounts(tenantId);
      const adAccountIds =
        accounts.length > 0 ? accounts.map((account) => account.id) : [undefined];

      const perAccountDtos = await Promise.all(
        adAccountIds.map((adAccountId) =>
          this.metaAdsService.pullCampaigns(
            {
              datePreset: ACCOUNT_SUMMARY_DATE_PRESET,
              ...(adAccountId !== undefined ? { adAccountId } : {}),
            },
            correlationId,
            tenantId,
          ),
        ),
      );

      return perAccountDtos
        .flatMap((dto) => dto.campaigns)
        .filter((campaign) => campaign.status === "ACTIVE");
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : String(caught);
      errors["campaigns"] = reason;
      this.logger.warn(
        `CommandCenterService.getAccountSummary: campaign enumeration failed: ${reason}`,
      );
      return [];
    }
  }

  /**
   * Runs the real `CampaignHealthService.assess` for every real active campaign in parallel.
   * `campaign.metaId` (the real Meta campaign id) is what `assess()`/`MetricSnapshotService`
   * actually key their `meta_insights_daily` reads on — NOT `campaign.id` (an internal, randomly
   * generated `CampaignId` UUID, verified via `CampaignMapper.ts`, with no real Meta meaning).
   * One campaign's `assess()` failure is recorded under `errors["campaignHealth:<metaId>"]` and
   * excluded from the result — never aborts the other real campaigns' assessments.
   */
  private async assessCampaigns(
    tenantId: string,
    campaigns: readonly CampaignResponseDto[],
    errors: Record<string, string>,
  ): Promise<readonly CampaignHealthSummaryEntryDto[]> {
    const results = await Promise.all(
      campaigns.map(async (campaign): Promise<CampaignHealthSummaryEntryDto | undefined> => {
        try {
          const response: CampaignHealthResponseDto = await this.campaignHealthService.assess(
            tenantId,
            campaign.metaId,
          );
          return {
            campaignId: response.campaignId,
            campaignName: campaign.name,
            spend: campaign.spend,
            health: response.health,
            diagnosis: response.diagnosis,
            decision: response.decision,
          };
        } catch (caught) {
          const reason = caught instanceof Error ? caught.message : String(caught);
          errors[`campaignHealth:${campaign.metaId}`] = reason;
          this.logger.warn(
            `CommandCenterService.getAccountSummary: assess(${campaign.metaId}) failed: ${reason}`,
          );
          return undefined;
        }
      }),
    );
    return results.filter((entry): entry is CampaignHealthSummaryEntryDto => entry !== undefined);
  }

  /**
   * AAOS Command Center creative thumbnails — attaches each campaign row's real
   * `representativeCreative`, using ONLY data already in hand plus at most 3 additional reads for
   * the WHOLE response (not per campaign):
   *
   *  1. The campaign tree `enumerateActiveCampaigns` already pulled — every ad, with its real
   *     `status`/`verdict`/`spend`/`impressions`/`createdAt`/`creativeAsset`. NO new Meta pull.
   *  2. ONE tenant-scoped `ab_test_variants` read — the real per-Meta-ad A/B-test `WINNER` outcome.
   *  3. ONE tenant-scoped `creative_packages` read — the real Kai lineage
   *     (`published_meta_ad_ids` -> package id + generated asset URL).
   *  4. `MetaAdsService.resolveCreativeThumbnails` — ONE batched `adimages` call for every selected
   *     IMAGE hash across all rows, plus one capped call per selected VIDEO id. Long-TTL cached per
   *     ref, so a warm cache spends zero Meta calls.
   *
   * Cold-start worst case for a page load: 1 batched image call + (number of distinct selected
   * video ids, capped at `MAX_VIDEO_THUMBNAIL_CALLS`) — on top of the campaign pull this endpoint
   * already performed, and only once per 5-minute cache window.
   *
   * THE HONEST KAI-LINEAGE LIMIT: the only persisted Meta->Kai link in this codebase is
   * `creative_packages.published_meta_ad_ids` (an AD id list). Nothing anywhere persists the Meta
   * image HASH / VIDEO ID that `UploadCreativeAsset` returns back against the package that was
   * uploaded — so lineage here is resolved by AD id, and a campaign whose representative ad was
   * created outside a Kai-publishing path simply carries no lineage fields rather than a guess.
   *
   * Never throws. Any failure is recorded under `errors["representativeCreative"]` (or its
   * per-source siblings) and the affected rows are returned UNCHANGED, i.e. still rendering with
   * their existing listing photo / placeholder.
   */
  private async attachRepresentativeCreatives(
    tenantId: string,
    campaigns: readonly CampaignResponseDto[],
    entries: readonly CampaignHealthSummaryEntryDto[],
    errors: Record<string, string>,
  ): Promise<readonly CampaignHealthSummaryEntryDto[]> {
    if (entries.length === 0) {
      return entries;
    }

    try {
      const [abTestWinnerAdIds, kaiLineage] = await Promise.all([
        this.getAbTestWinnerAdIds(tenantId, errors),
        this.getKaiLineage(tenantId, errors),
      ]);

      // Campaign rows are keyed by the real Meta campaign id (`CampaignHealthSummaryEntryDto
      // .campaignId` is `Campaign.metaId` — see that DTO's own doc), which is exactly what the
      // pulled campaign carries as `metaId`.
      const selectionsByCampaignId = new Map<string, RepresentativeCreativeSelection>();
      for (const campaign of campaigns) {
        const candidates = campaign.adSets.flatMap((adSet) =>
          adSet.ads.map((ad): RepresentativeCreativeCandidate => ({
            metaAdId: ad.metaId,
            status: ad.status,
            verdict: ad.verdict,
            spend: ad.metrics.spend,
            impressions: ad.metrics.impressions,
            createdAtIso: ad.createdAt,
            ...(ad.creativeAsset !== undefined ? { creativeAsset: ad.creativeAsset } : {}),
            abTestWinner: abTestWinnerAdIds.has(ad.metaId),
          })),
        );
        const selection = selectRepresentativeCreative(candidates);
        if (selection !== undefined) {
          selectionsByCampaignId.set(campaign.metaId, selection);
        }
      }

      if (selectionsByCampaignId.size === 0) {
        return entries;
      }

      // ONE resolution pass for every selected ref across every row — the batching that keeps this
      // within the real 200-calls/hour budget.
      const thumbnailUrlsByRef = await this.metaAdsService.resolveCreativeThumbnails(
        tenantId,
        [...selectionsByCampaignId.values()].map((selection) => ({
          kind: selection.kind,
          ref: selection.metaCreativeRef,
        })),
      );

      return entries.map((entry) => {
        const selection = selectionsByCampaignId.get(entry.campaignId);
        if (selection === undefined) {
          return entry;
        }
        const thumbnailUrl = thumbnailUrlsByRef.get(selection.metaCreativeRef);
        const lineage = kaiLineage.get(selection.metaAdId);
        const representativeCreative: RepresentativeCreativeDto = {
          kind: selection.kind,
          metaAdId: selection.metaAdId,
          metaCreativeRef: selection.metaCreativeRef,
          priorityTier: selection.priorityTier,
          ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}),
          ...(selection.badge !== undefined ? { badge: selection.badge } : {}),
          ...(lineage !== undefined ? { kaiCreativePackageId: lineage.creativePackageId } : {}),
          ...(lineage?.assetUrl !== undefined ? { assetUrl: lineage.assetUrl } : {}),
        };
        return { ...entry, representativeCreative };
      });
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : String(caught);
      errors["representativeCreative"] = reason;
      this.logger.warn(
        `CommandCenterService.getAccountSummary: representative-creative resolution failed, rows keep their placeholder: ${reason}`,
      );
      return entries;
    }
  }

  /**
   * Samantha Attention Queue row mini sparkline — attaches each row's real per-campaign daily
   * series, read from `meta_insights_daily` via the already-live
   * `MetaAdsService.getCampaignHistory` -> `MetaSyncService.getCampaignHistory` ->
   * `MetaSyncRepository.getCampaignDailyHistory` chain (`level = 'campaign'`, oldest-to-newest).
   *
   * WHY THIS IS SAFE FOR THE REAL META BUDGET: that chain is a plain Postgres read of rows
   * `MetaSyncCronService` already captured. It performs NO Meta Ads API call, so it adds ZERO to the
   * real 200-calls/hour `TokenBucketRateLimiter` budget whose exhaustion
   * `ACCOUNT_SUMMARY_CACHE_TTL_MS` documents. It also runs INSIDE that same cached path, so a
   * repeated page load inside the 5-minute window costs no DB read either.
   *
   * WHICH METRIC: the campaign's OWN real `diagnosis.rootCause`, via
   * `TREND_METRIC_BY_ROOT_CAUSE` — so the series is the metric the diagnosis is genuinely about. A
   * root cause that maps to none of the 3 real series (or an absent root cause) means this row is
   * skipped entirely, never given a default metric.
   *
   * WHICH ROWS: at most `MAX_CAMPAIGNS_WITH_TREND`, chosen by the same real
   * impact-then-confidence ranking the queue itself displays in.
   *
   * HONEST DEGRADE, never a fake flat line: fewer than 2 real points, a non-finite value throughout,
   * or a failed read all leave the row's `trend` ABSENT (recorded under `campaignTrend:<id>` for the
   * failure case). The frontend's `Sparkline` already renders nothing below 2 points.
   */
  private async attachTrends(
    tenantId: string,
    entries: readonly CampaignHealthSummaryEntryDto[],
    errors: Record<string, string>,
  ): Promise<readonly CampaignHealthSummaryEntryDto[]> {
    const candidates = entries
      .map((entry) => ({
        entry,
        metric:
          entry.diagnosis.rootCause !== undefined
            ? TREND_METRIC_BY_ROOT_CAUSE[entry.diagnosis.rootCause]
            : undefined,
      }))
      .filter(
        (
          candidate,
        ): candidate is { entry: CampaignHealthSummaryEntryDto; metric: CampaignTrendMetric } =>
          candidate.metric !== undefined,
      )
      .sort((a, b) => {
        const impactDelta =
          (IMPACT_RANK[b.entry.decision.impact] ?? 0) - (IMPACT_RANK[a.entry.decision.impact] ?? 0);
        return impactDelta !== 0
          ? impactDelta
          : b.entry.decision.confidence - a.entry.decision.confidence;
      })
      .slice(0, MAX_CAMPAIGNS_WITH_TREND);

    if (candidates.length === 0) {
      return entries;
    }

    const trendsByCampaignId = new Map<string, CampaignTrendDto>();
    await Promise.all(
      candidates.map(async ({ entry, metric }) => {
        try {
          const history = await this.metaAdsService.getCampaignHistory(
            tenantId,
            entry.campaignId,
            TREND_DAYS,
          );
          const points = history.points
            .map((point) => point[metric])
            .filter(
              (value): value is number => typeof value === "number" && Number.isFinite(value),
            );
          // Fewer than 2 real days is not a trend — omit rather than pad.
          if (points.length < 2) {
            return;
          }
          trendsByCampaignId.set(entry.campaignId, { metric, points });
        } catch (caught) {
          const reason = caught instanceof Error ? caught.message : String(caught);
          errors[`campaignTrend:${entry.campaignId}`] = reason;
          this.logger.warn(
            `CommandCenterService.getAccountSummary: campaign history read for ${entry.campaignId} failed, that row renders without a sparkline: ${reason}`,
          );
        }
      }),
    );

    if (trendsByCampaignId.size === 0) {
      return entries;
    }

    return entries.map((entry) => {
      const trend = trendsByCampaignId.get(entry.campaignId);
      return trend !== undefined ? { ...entry, trend } : entry;
    });
  }

  /**
   * The real, per-Meta-ad A/B-test winner set — `ab_test_variants` rows whose `status` is `WINNER`
   * and that carry a real `meta_ad_id`. One tenant-scoped read. Returns an EMPTY set (never throws,
   * never fabricates) when the repository is unavailable or the read fails, which honestly degrades
   * the badge to Samantha's own `SCALE` verdict proxy.
   */
  private async getAbTestWinnerAdIds(
    tenantId: string,
    errors: Record<string, string>,
  ): Promise<ReadonlySet<string>> {
    if (this.abTestVariants === undefined) {
      return new Set();
    }
    try {
      const variants = await this.abTestVariants.listByTenant(tenantId);
      return new Set(
        variants
          .filter((variant) => variant.status === "WINNER" && variant.metaAdId !== undefined)
          .map((variant) => variant.metaAdId as string),
      );
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : String(caught);
      errors["abTestWinners"] = reason;
      this.logger.warn(
        `CommandCenterService.getAccountSummary: ab_test_variants read failed, WINNER badge falls back to the SCALE verdict: ${reason}`,
      );
      return new Set();
    }
  }

  /** Real Kai lineage by Meta ad id (`creative_packages.published_meta_ad_ids`). One tenant-scoped read; an empty map on failure means rows simply carry no lineage fields, never invented ones. */
  private async getKaiLineage(
    tenantId: string,
    errors: Record<string, string>,
  ): Promise<
    ReadonlyMap<string, { readonly creativePackageId: string; readonly assetUrl?: string }>
  > {
    try {
      return await this.creativeMemoryService.getKaiLineageByMetaAdId(tenantId);
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : String(caught);
      errors["kaiLineage"] = reason;
      this.logger.warn(
        `CommandCenterService.getAccountSummary: Kai lineage read failed, rows carry no Kai fields: ${reason}`,
      );
      return new Map();
    }
  }

  /** Real, account-wide `CreativeMemoryService.getAnglePerformance` — one call, never per-campaign. A failure is recorded honestly under `errors["creativeMemory"]` and returns `[]`, matching this method's sibling `enumerateActiveCampaigns`'s own partial-failure discipline. */
  private async getAngles(
    tenantId: string,
    errors: Record<string, string>,
  ): Promise<readonly AnglePerformanceResult[]> {
    try {
      const response = await this.creativeMemoryService.getAnglePerformance(tenantId);
      return response.angles;
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : String(caught);
      errors["creativeMemory"] = reason;
      this.logger.warn(
        `CommandCenterService.getAccountSummary: getAnglePerformance failed: ${reason}`,
      );
      return [];
    }
  }
}
