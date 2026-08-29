import { randomUUID } from "node:crypto";

import { ALL_BRANCH_IDS, BranchId } from "@aos/branch-manager";
import type { CapiConnector } from "@aos/capi-connector";
import { NotFoundError } from "@aos/errors";
import type { IClosingRepository, LeadStore } from "@aos/lead-store";
import {
  ALL_AUTOMOTIVE_ANGLE_VALUES,
  ALL_PROPERTY_ANGLE_VALUES,
  AnomalyDetector,
  ClosingIntelService,
  CompetitorIntelService,
  GoogleTrendsService,
  InventoryIntelService,
  LeadIntelService,
  SeasonalCalendarService,
  getBrandAngleIds,
  interpretForCampaign,
  type AdFrequencySignal,
  type CompetitorPageConfig,
  type FrequencyHighAnomaly,
  type IntelVertical,
  type PropertyListingSnapshot,
} from "@aos/meta-ads-agent";
import { AdAccountId } from "@aos/meta-ads-connector";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import {
  AAOS_API_CONFIG,
  CAPI_CONNECTOR,
  LEAD_STORE,
  LEAD_STORE_CLOSING_REPOSITORY,
  META_ADS_CONNECTOR_REGISTRY,
} from "../../di-tokens.js";
import type { ListingRow } from "../listings/infrastructure/listing.repository.js";
import { ListingRepository } from "../listings/infrastructure/listing.repository.js";
import type {
  CampaignStrategyRequestDto,
  CampaignStrategyResponseDto,
} from "../llm/dto/campaign-strategy.dto.js";
import { LlmService } from "../llm/llm.service.js";
import {
  AdTenantIndexRepository,
  indexPulledAdAccount,
} from "../meta-ads/infrastructure/ad-tenant-index.repository.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";
import type { TenantRow } from "../superadmin/infrastructure/tenant.repository.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import {
  toIntelligenceSignalsResponseDto,
  type CreateCompetitorPageBodyDto,
  type IntelligenceSignalsResponseDto,
} from "./dto/intelligence.dto.js";
import type { CompetitorPageRow } from "./infrastructure/competitor-page.repository.js";
import { CompetitorPageRepository } from "./infrastructure/competitor-page.repository.js";
import { IntelligenceSignalsRepository } from "./infrastructure/intelligence-signals.repository.js";

const CLOSING_LOOKBACK_DAYS = 90;
/** Nationwide Google Trends geo — see class docstring's "single-tenant, single-run" scoping note. */
const TRENDS_BRANCH = BranchId.UMUM;
/** Matches `SchedulerService`'s own `DEFAULT_DATE_PRESET` — `buildAnomalyContext` only needs the CURRENT `frequency` figure, not a specific window, so it reuses the same default every other real pull in this app uses. */
const ANOMALY_DATE_PRESET = "last_30d" as const;

/** AAOS-META-MCP-BONUS-TOOLS (Tool 4) — real `EmqReport`-backed shape, or an honest `available:false` degrade. See `IntelligenceService.buildCapiHealthContext`. */
export type CapiHealthContext =
  | {
      readonly available: true;
      readonly pixelId: string;
      readonly score: number;
      readonly eventsReceived: number;
      readonly capturedAt: string;
      readonly reasoning: string;
    }
  | { readonly available: false; readonly reasoning: string };

/** AAOS-META-MCP-BONUS-TOOLS (Tool 1) — real `FREQUENCY_HIGH`-only anomaly list. `available` is always `true` here (an empty list is still a real, honest result) — kept as a discriminated shape for symmetry with `CapiHealthContext` and every other signal context in this file. */
export interface AnomalyContext {
  readonly available: true;
  readonly anomalies: ReadonlyArray<FrequencyHighAnomaly>;
  readonly reasoning: string;
}

function toPropertyListingSnapshot(row: ListingRow): PropertyListingSnapshot {
  return {
    id: row.id,
    title: row.title,
    listingStatus: row.listing_status,
    createdAt: new Date(row.created_at),
  };
}

function toIntelVertical(rawVertical: string): IntelVertical {
  return rawVertical === "PROPERTY" ? "PROPERTY" : "AUTOMOTIVE";
}

/**
 * AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 4 — aggregates the 5 real signal services built in Phases
 * 1-3 (`SeasonalCalendarService`, `InventoryIntelService`, `LeadIntelService`,
 * `ClosingIntelService`, `CompetitorIntelService`, `GoogleTrendsService` — 6 classes, 5 "sources"
 * per the spec's own numbering) for the single composed tenant (`AAOS_TENANT_ID` — no per-tenant
 * loop, per the recurring single-tenant-composition finding every prior phase this session has
 * confirmed), synthesizes them via `LlmService.campaignStrategy`, and persists the result.
 *
 * SCOPING NOTE — real inputs, honestly composed:
 * - **Vertical**: read from the real `tenants.vertical` column via `TenantRepository`
 *   (`findByTenantId`), the same real source `apps/aaos-api`'s Multi-Tenant work already
 *   established — never hardcoded.
 * - **Seasonal/Trends**: run once per refresh, not once per branch. Google Trends' real API is
 *   geo-scoped (`GoogleTrendsService.getTrends(vertical, branch)`); this service deliberately runs
 *   it against `BranchId.UMUM` (nationwide) rather than looping every branch — a real, documented
 *   scoping decision (not a Phase 1-3 service limitation) to keep one Samantha Intelligence run to a
 *   bounded, small number of real external calls, consistent with `GoogleTrendsService`'s own
 *   "low-volume, at most a few calls per day" design assumption.
 * - **Lead profile**: real hot leads across EVERY branch (`LeadStore.getHotLeads.execute`, fanned
 *   out over `ALL_BRANCH_IDS` — the exact same pattern `SchedulerService.countHotLeads()` already
 *   establishes for this app), fed into `LeadIntelService.getHotLeadProfile` — no fabricated
 *   per-branch loop of that service, which already returns a `topBranches` breakdown.
 * - **Closings**: real `closings` rows from the last `CLOSING_LOOKBACK_DAYS` (90, matching the
 *   spec's own window) across every branch, via the already-composed `LEAD_STORE_CLOSING_REPOSITORY`
 *   (`IClosingRepository.findByFilter`) — same repository `modules/closings` already uses.
 * - **Inventory**: PROPERTY reads real `listings` rows via a `ListingRepository` instance composed
 *   from the shared `SUPABASE_CLIENT` (mirrors `ListingsModule`'s own composition), mapped into
 *   `InventoryIntelService.propertySignals`'s real `PropertyListingSnapshot` shape. AUTOMOTIVE is
 *   HONESTLY DEFERRED: this app has no real, composed `@aos/dss-inventory-connector`
 *   `IInventoryQueryService` anywhere (confirmed by direct search — `packages/sales-agent`'s
 *   `ClaraAgentFactory` requires one but is never itself composed inside `apps/aaos-api`; the only
 *   real automotive stock data this app has is `@aos/mobix-web-scraper`'s `ScrapedUnit`, which has
 *   no honest "days since first added to inventory" field to compute `InventoryIntelService`'s
 *   `newArrivalUnits`/`slowMovingUnits` from — `scraped_at` is a last-scrape timestamp, refreshed
 *   on every run, not a first-seen date). Standing up a real `IInventoryQueryService` composition
 *   backed by `scraped_units` is a genuine, separate architecture decision, out of scope for this
 *   pass — flagged honestly here (`inventory.available: false`) rather than fabricated.
 * - **Competitor**: real, tenant-managed `competitor_pages` rows (`CompetitorPageRepository`,
 *   filtered to `active = true` + this run's real `vertical`) passed to
 *   `CompetitorIntelService.getCompetitorAds` — only when `META_APP_ID`/`META_APP_SECRET` are both
 *   configured (the real Meta App Access Token this service needs); otherwise an honest
 *   `available: false` signal, no network call attempted.
 * - **CAPI Health** (AAOS-META-MCP-BONUS-TOOLS Tool 4): real `EmqReport` via the composed
 *   `CapiConnector.getEmqScore`, only when `CAPI_PIXEL_ID`/`CAPI_ACCESS_TOKEN` are both configured
 *   — otherwise an honest `available: false` signal. Renders only `EmqReport`'s real fields
 *   (`pixelId`/`score`/`eventsReceived`/`capturedAt`) — no fabricated per-event-type breakdown.
 * - **Anomaly Signal** (AAOS-META-MCP-BONUS-TOOLS Tool 1, honestly scoped down): real
 *   `FREQUENCY_HIGH`-only anomalies (`@aos/meta-ads-agent`'s `AnomalyDetector.detectFrequencyHigh`)
 *   from every configured ad account's current `AdMetrics.frequency`, pulled via the same,
 *   already-global `MetaAdsConnector.pullCampaignData` every other Meta Ads feature uses. Every
 *   other anomaly type from the original spec is DEFERRED — this app has no historical/time-series
 *   metrics storage to compute a "current vs. expected" comparison from honestly.
 */
@Injectable()
export class IntelligenceService {
  private readonly logger = new Logger(IntelligenceService.name);

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(LEAD_STORE) private readonly leadStore: LeadStore,
    @Inject(LEAD_STORE_CLOSING_REPOSITORY) private readonly closingRepository: IClosingRepository,
    private readonly llmService: LlmService,
    private readonly tenantRepository: TenantRepository,
    private readonly listingRepository: ListingRepository,
    private readonly signalsRepository: IntelligenceSignalsRepository,
    private readonly competitorPageRepository: CompetitorPageRepository,
    private readonly seasonalCalendarService: SeasonalCalendarService,
    private readonly trendsService: GoogleTrendsService,
    // AAOS-META-MCP-BONUS-TOOLS (Tool 4) — the composed `@aos/capi-connector` `CapiConnector`,
    // `undefined` on a deployment with no CAPI pixel/token configured (see `di-tokens.ts`'s
    // `CAPI_CONNECTOR` doc). A real, always-registered `useValue` provider (even when the value
    // itself is `undefined`), so plain `@Inject` resolves fine without `@Optional()` — same
    // pattern already established for `ASSET_LIBRARY`/`KAI_AGENT_RUNTIME` elsewhere in this app.
    @Inject(CAPI_CONNECTOR) private readonly capiConnector: CapiConnector | undefined,
    // AAOS-META-MCP-BONUS-TOOLS (Tool 1) — the same real, already-global `MetaAdsConnector` every
    // other Meta Ads feature in this app uses, reused here (not re-composed) to pull real
    // `AdMetrics.frequency` for `AnomalyDetector.detectFrequencyHigh`.
    @Inject(META_ADS_CONNECTOR_REGISTRY)
    private readonly metaAdsConnectorRegistry: MetaAdsConnectorRegistry,
    private readonly adTenantIndex: AdTenantIndexRepository,
    // `@Optional()` — a bare `Function`-typed constructor param with a default value still gets a
    // real DI resolution attempt from Nest (this session's recurring DI gotcha — see
    // `RecyclingService`'s own `now` param for the original fix). Without this, real bootstrap
    // fails with "Nest can't resolve dependencies of the IntelligenceService (..., ?)".
    @Optional() private readonly now: () => Date = () => new Date(),
    // `@Optional()`, same rationale as `now` above — injectable so tests can generate
    // deterministic ids for `GetEmqScore`'s required `correlationId`, defaulting to the real
    // `crypto.randomUUID` at runtime.
    @Optional() private readonly generateCorrelationId: () => string = () => randomUUID(),
  ) {}

  /** `GET /api/v1/intelligence/signals` — the latest real persisted row for this tenant, or `undefined` when none has ever been generated. */
  async getLatest(): Promise<IntelligenceSignalsResponseDto | undefined> {
    const row = await this.signalsRepository.findLatestByTenant(this.config.AAOS_TENANT_ID);
    return row === undefined ? undefined : toIntelligenceSignalsResponseDto(row);
  }

  /** `POST /api/v1/intelligence/refresh` and the `SAMANTHA_INTELLIGENCE_REFRESH` Kalender handler — runs the full real aggregation + synthesis synchronously and persists the result. */
  async refresh(): Promise<IntelligenceSignalsResponseDto> {
    const tenant = await this.findTenantOrThrow();
    const vertical = toIntelVertical(tenant.vertical);

    const seasonalContext = this.buildSeasonalContext(vertical);
    const trendsContext = await this.buildTrendsContext(vertical);
    const competitorContext = await this.buildCompetitorContext(tenant, vertical);
    const inventoryContext = await this.buildInventoryContext(tenant, vertical);
    const leadProfileContext = await this.buildLeadProfileContext();
    const closingContext = await this.buildClosingContext();
    const capiHealthContext = await this.buildCapiHealthContext();
    const anomalyContext = await this.buildAnomalyContext();

    const brandAngleIds = getBrandAngleIds(vertical);
    const productAngleValues =
      vertical === "AUTOMOTIVE" ? ALL_AUTOMOTIVE_ANGLE_VALUES : ALL_PROPERTY_ANGLE_VALUES;

    const strategyRequest: CampaignStrategyRequestDto = {
      vertical,
      tenantName: tenant.name,
      branchId: TRENDS_BRANCH,
      brandAngleIds: [...brandAngleIds],
      productAngleValues: [...productAngleValues],
      seasonal: seasonalContext,
      trends: trendsContext,
      competitor: competitorContext,
      inventory: inventoryContext,
      leadProfile: leadProfileContext,
      closing: closingContext,
    };
    const campaignStrategy: CampaignStrategyResponseDto =
      await this.llmService.campaignStrategy(strategyRequest);

    const digestText = buildDigestText(
      tenant.name,
      seasonalContext,
      trendsContext,
      competitorContext,
      inventoryContext,
      leadProfileContext,
      closingContext,
      capiHealthContext,
      anomalyContext,
      campaignStrategy,
    );

    const row = await this.signalsRepository.insert({
      tenant_id: this.config.AAOS_TENANT_ID,
      branch_id: null,
      seasonal_data: seasonalContext,
      trends_data: trendsContext,
      competitor_data: competitorContext,
      inventory_data: inventoryContext,
      lead_profile_data: leadProfileContext,
      closing_data: closingContext,
      capi_health_data: capiHealthContext,
      anomaly_data: anomalyContext,
      campaign_strategy: campaignStrategy,
      digest_text: digestText,
    });
    return toIntelligenceSignalsResponseDto(row);
  }

  // ---------------------------------------------------------------------------------------------
  // Competitor pages CRUD — `GET/POST /api/v1/competitors`, `DELETE /api/v1/competitors/:id`.
  // ---------------------------------------------------------------------------------------------

  async listCompetitorPages(): Promise<readonly CompetitorPageRow[]> {
    return this.competitorPageRepository.listByTenant(this.config.AAOS_TENANT_ID);
  }

  async createCompetitorPage(body: CreateCompetitorPageBodyDto): Promise<CompetitorPageRow> {
    return this.competitorPageRepository.insert({
      tenant_id: this.config.AAOS_TENANT_ID,
      name: body.name,
      page_id: body.pageId,
      vertical: body.vertical,
      active: body.active,
    });
  }

  async deleteCompetitorPage(id: string): Promise<void> {
    const existing = await this.competitorPageRepository.findById(id);
    if (existing === undefined) {
      throw new NotFoundError(`No competitor page found with id "${id}"`);
    }
    await this.competitorPageRepository.deleteById(id);
  }

  // ---------------------------------------------------------------------------------------------
  // Signal builders — one per real source, each honestly degrading (never fabricating) when its
  // real dependency is unavailable/unconfigured.
  // ---------------------------------------------------------------------------------------------

  private buildSeasonalContext(vertical: IntelVertical): CampaignStrategyRequestDto["seasonal"] {
    const recommendation = this.seasonalCalendarService.getRecommendation(vertical, this.now());
    return {
      isSpecialPeriod: recommendation.isSpecialPeriod,
      ...(recommendation.eventName !== undefined ? { eventName: recommendation.eventName } : {}),
      ...(recommendation.budgetMultiplier !== undefined
        ? { budgetMultiplier: recommendation.budgetMultiplier }
        : {}),
      ...(recommendation.upcomingEvent !== undefined
        ? { upcomingEvent: recommendation.upcomingEvent }
        : {}),
      ...(recommendation.daysUntil !== undefined ? { daysUntil: recommendation.daysUntil } : {}),
      ...(recommendation.recommendedAngles !== undefined
        ? { recommendedAngles: recommendation.recommendedAngles.map(String) }
        : {}),
      reasoning: recommendation.reasoning,
    };
  }

  private async buildTrendsContext(
    vertical: IntelVertical,
  ): Promise<CampaignStrategyRequestDto["trends"]> {
    if (this.trendsService.isCircuitOpen()) {
      return {
        available: false,
        reasoning: "Google Trends circuit breaker terbuka (terlalu banyak kegagalan beruntun).",
      };
    }
    const result = await this.trendsService.getTrends(vertical, TRENDS_BRANCH);
    if (!result.ok) {
      return { available: false, reasoning: result.error.message };
    }
    const signal = interpretForCampaign(result.value, vertical);
    return {
      available: true,
      shouldScaleBudget: signal.shouldScaleBudget,
      suggestedAngle: String(signal.suggestedAngle),
      risingKeywords: result.value.filter((t) => t.trend === "RISING").map((t) => t.keyword),
      reasoning: signal.reasoning,
    };
  }

  private async buildCompetitorContext(
    tenant: TenantRow,
    vertical: IntelVertical,
  ): Promise<CampaignStrategyRequestDto["competitor"]> {
    if (this.config.META_APP_ID.length === 0 || this.config.META_APP_SECRET.length === 0) {
      return {
        available: false,
        reasoning: "META_APP_ID/META_APP_SECRET belum dikonfigurasi untuk Meta Ad Library.",
      };
    }
    const pages = await this.competitorPageRepository.listActiveByTenantAndVertical(
      tenant.tenant_id,
      vertical,
    );
    const pageConfigs: CompetitorPageConfig[] = pages.map((page) => ({
      name: page.name,
      pageId: page.page_id,
      vertical,
    }));
    const accessToken = CompetitorIntelService.buildAppAccessToken(
      this.config.META_APP_ID,
      this.config.META_APP_SECRET,
    );
    const service = new CompetitorIntelService({ accessToken });
    const result = await service.getCompetitorAds(pageConfigs);
    if (!result.ok) {
      this.logger.warn(
        `IntelligenceService.buildCompetitorContext: getCompetitorAds failed: ${result.error.message}`,
      );
      return { available: false, reasoning: result.error.message };
    }
    const signal = CompetitorIntelService.interpretForStrategy(result.value, vertical);
    return {
      available: true,
      saturatedAngles: [...signal.saturatedAngles],
      unusedAngles: [...signal.unusedAngles],
      ...(signal.topCompetitorAngle !== undefined
        ? { topCompetitorAngle: signal.topCompetitorAngle }
        : {}),
      reasoning: signal.reasoning,
    };
  }

  private async buildInventoryContext(
    tenant: TenantRow,
    vertical: IntelVertical,
  ): Promise<CampaignStrategyRequestDto["inventory"]> {
    if (vertical === "PROPERTY") {
      const rows = await this.listingRepository.listByTenant(tenant.tenant_id);
      const snapshots = rows.map(toPropertyListingSnapshot);
      const signal = InventoryIntelService.propertySignals(snapshots);
      return {
        available: true,
        hasNewArrivals: signal.newListings.length > 0,
        newArrivalItems: [...signal.newListings],
        recommendedAngle: signal.recommendedAngle,
        reasoning: `Total listing aktif: ${String(signal.totalActive)}.`,
      };
    }
    return {
      available: false,
      reasoning:
        "Belum ada IInventoryQueryService real yang dikomposisi di aaos-api untuk AUTOMOTIVE — lihat IntelligenceService docstring.",
    };
  }

  /** Real hot leads across every branch, fanned out the same way `SchedulerService.countHotLeads()` already does. */
  private async buildLeadProfileContext(): Promise<CampaignStrategyRequestDto["leadProfile"]> {
    const perBranch = await Promise.all(
      ALL_BRANCH_IDS.map((branchId) =>
        this.leadStore.getHotLeads.execute(branchId, this.config.AAOS_TENANT_ID),
      ),
    );
    const leads = perBranch.flatMap((result) => (result.ok ? result.value : []));
    const signal = LeadIntelService.getHotLeadProfile(leads);
    return {
      totalLeads: signal.totalLeads,
      avgScore: signal.avgScore,
      topBranches: signal.topBranches.map((b) => ({ branchId: b.branchId, count: b.count })),
      ...(signal.peakHour !== undefined ? { peakHour: signal.peakHour } : {}),
      ...(signal.peakDay !== undefined ? { peakDay: signal.peakDay } : {}),
    };
  }

  /** Real `closings` rows from the last `CLOSING_LOOKBACK_DAYS` days across every branch. */
  private async buildClosingContext(): Promise<CampaignStrategyRequestDto["closing"]> {
    const toDate = this.now();
    const fromDate = new Date(toDate.getTime() - CLOSING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.closingRepository.findByFilter({ fromDate, toDate });
    const closings = result.ok ? result.value : [];
    if (!result.ok) {
      this.logger.warn(
        `IntelligenceService.buildClosingContext: findByFilter failed: ${result.error.message}`,
      );
    }
    const signal = ClosingIntelService.getClosingSignals(closings);
    return {
      totalEvents: signal.totalEvents,
      topUnitModels: signal.topUnitModels
        .slice(0, 5)
        .map((u) => ({ unitModel: u.unitModel, spkCount: u.spkCount, closingRate: u.closingRate })),
      slowUnitModels: signal.slowUnitModels
        .slice(0, 5)
        .map((u) => ({ unitModel: u.unitModel, closingRate: u.closingRate })),
    };
  }

  /**
   * AAOS-META-MCP-BONUS-TOOLS (Tool 4 — "CAPI Health") — real `EmqReport` via
   * `capiConnector.getEmqScore`, or an honest `available:false` shape when CAPI isn't configured
   * or the real Meta call failed. Deliberately renders ONLY what `EmqReport` actually has
   * (`pixelId`/`score`/`eventsReceived`/`capturedAt`) — no fabricated per-event-type breakdown or
   * issues list (neither field exists on the real entity; see `docs/PROMPT-AAOS-META-MCP-BONUS-
   * TOOLS.md`'s coordinator note point 3).
   */
  private async buildCapiHealthContext(): Promise<CapiHealthContext> {
    if (this.capiConnector === undefined) {
      return {
        available: false,
        reasoning: "CAPI_PIXEL_ID/CAPI_ACCESS_TOKEN belum dikonfigurasi.",
      };
    }
    const result = await this.capiConnector.getEmqScore.execute({
      correlationId: this.generateCorrelationId(),
    });
    if (!result.ok) {
      this.logger.warn(
        `IntelligenceService.buildCapiHealthContext: getEmqScore failed: ${result.error.message}`,
      );
      return { available: false, reasoning: result.error.message };
    }
    const report = result.value;
    return {
      available: true,
      pixelId: report.pixelId,
      score: report.score.value,
      eventsReceived: report.eventsReceived,
      capturedAt: report.capturedAt.toISOString(),
      reasoning: `CAPI Event Match Quality score ${report.score.value.toFixed(1)}/10, ${String(report.eventsReceived)} event diterima.`,
    };
  }

  /**
   * AAOS-META-MCP-BONUS-TOOLS (Tool 1 — "Anomaly Signal", honestly scoped down) — real
   * `FREQUENCY_HIGH` anomalies from every configured ad account's already-pulled real
   * `AdMetrics.frequency`, via `AnomalyDetector.detectFrequencyHigh`. Every other anomaly type
   * from the original spec (`SPEND_DROP`/`SPEND_SPIKE`/`CPL_INCREASE`/`CTR_DROP`/
   * `DELIVERY_ISSUE`/`LOW_QUALITY_SCORE`) is deferred — this app has no historical/time-series
   * metrics storage to honestly compute them from (see `AnomalyDetector`'s own docstring).
   *
   * Sequential per-account pulls (not `Promise.all`) — same rationale as
   * `MetaAdsSyncService.syncAccounts`: respects the shared rate limiter's single-threaded token
   * accounting. A single account's pull failing is logged and skipped, never fails the whole
   * signal (same degrade-per-source discipline as `buildCompetitorContext`/`buildClosingContext`).
   */
  private async buildAnomalyContext(): Promise<AnomalyContext> {
    const ads: AdFrequencySignal[] = [];
    const connectorResult = await this.metaAdsConnectorRegistry.resolve(this.config.AAOS_TENANT_ID);
    if (!connectorResult.ok) {
      this.logger.warn(
        `IntelligenceService.buildAnomalyContext: connector resolution failed: ${connectorResult.error.message}`,
      );
      return {
        available: true,
        anomalies: [],
        reasoning: "Meta Ads connector belum terkonfigurasi untuk tenant ini.",
      };
    }
    const connector = connectorResult.value;
    for (const rawAccountId of connector.adAccountIds) {
      const accountIdResult = AdAccountId.create(rawAccountId);
      if (!accountIdResult.ok) {
        this.logger.warn(
          `IntelligenceService.buildAnomalyContext: invalid ad account id "${rawAccountId}": ${accountIdResult.error.message}`,
        );
        continue;
      }
      const result = await connector.pullCampaignData.execute({
        adAccountId: accountIdResult.value,
        datePreset: ANOMALY_DATE_PRESET,
        accessToken: connector.accessToken,
        tenantId: this.config.AAOS_TENANT_ID,
        correlationId: this.generateCorrelationId(),
      });
      if (!result.ok) {
        this.logger.warn(
          `IntelligenceService.buildAnomalyContext: pullCampaignData failed for "${rawAccountId}": ${result.error.message}`,
        );
        continue;
      }
      // AAOS-MULTI-TENANT-PHASE1C — best-effort, never-throwing index of this pull's real ads, so
      // a later Meta lead webhook can resolve this tenant honestly.
      await indexPulledAdAccount(this.adTenantIndex, this.config.AAOS_TENANT_ID, result.value);
      for (const campaign of result.value.campaigns) {
        for (const adSet of campaign.adSets) {
          for (const ad of adSet.ads) {
            ads.push({
              adId: ad.id.toString(),
              adName: ad.name,
              frequency: ad.metrics.frequency,
            });
          }
        }
      }
    }
    const anomalies = AnomalyDetector.detectFrequencyHigh(ads);
    return {
      available: true,
      anomalies,
      reasoning:
        anomalies.length === 0
          ? "Tidak ada anomali frequency terdeteksi."
          : `${String(anomalies.length)} iklan dengan frequency tinggi (creative fatigue) terdeteksi.`,
    };
  }

  private async findTenantOrThrow(): Promise<TenantRow> {
    const tenant = await this.tenantRepository.findByTenantId(this.config.AAOS_TENANT_ID);
    if (tenant === undefined) {
      throw new NotFoundError(`No tenant row found for tenant_id "${this.config.AAOS_TENANT_ID}"`);
    }
    return tenant;
  }
}

/** Real, Indonesian, generated-at-write-time summary — same "one real summary line per real source" discipline the Daily Digest already establishes for A/B test wins/Lookalike sync milestones. */
function buildDigestText(
  tenantName: string,
  seasonal: CampaignStrategyRequestDto["seasonal"],
  trends: CampaignStrategyRequestDto["trends"],
  competitor: CampaignStrategyRequestDto["competitor"],
  inventory: CampaignStrategyRequestDto["inventory"],
  leadProfile: CampaignStrategyRequestDto["leadProfile"],
  closing: CampaignStrategyRequestDto["closing"],
  capiHealth: CapiHealthContext,
  anomaly: AnomalyContext,
  strategy: CampaignStrategyResponseDto,
): string {
  const lines = [
    `🧠 Samantha Intelligence — ${tenantName}`,
    `📅 Seasonal: ${seasonal.reasoning}`,
    `📈 Trends: ${trends.reasoning}`,
    `🔍 Kompetitor: ${competitor.reasoning}`,
    `📦 Stok/Listing: ${inventory.reasoning}`,
    `👥 Hot leads: ${String(leadProfile.totalLeads)} lead, avg score ${leadProfile.avgScore.toFixed(1)}`,
    `💰 Closing (90 hari): ${String(closing.totalEvents)} event`,
    `📡 CAPI Health: ${capiHealth.reasoning}`,
    `⚠ Anomali: ${anomaly.reasoning}`,
    strategy.available
      ? `🎯 Rekomendasi: ${strategy.summary}`
      : `🎯 Rekomendasi: AI tidak tersedia (${strategy.reason}) — ${strategy.message}`,
  ];
  return lines.join("\n");
}
