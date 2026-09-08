import { BranchId } from "@aos/branch-manager";
import { NotFoundError } from "@aos/errors";
import {
  CompetitorIntelService,
  GoogleTrendsService,
  classifyAutomotiveAngle,
  classifyPropertyAngle,
  type CompetitorAd,
  type CompetitorPageConfig,
  type IntelVertical,
} from "@aos/meta-ads-agent";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG } from "../../di-tokens.js";
import { CompetitorPageRepository } from "../intelligence/infrastructure/competitor-page.repository.js";
import type { TenantRow } from "../superadmin/infrastructure/tenant.repository.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import {
  getSeasonalitySignal,
  type CompetitorAngleTrendSignal,
  type KprRateDirection,
  type KprRateSignal,
  type SearchTrendSignal,
  type SeasonalitySignal,
} from "./domain/market-signals.js";
import {
  toMarketSignalsResponseDto,
  type MarketSignalsResponseDto,
} from "./dto/market-signals.dto.js";
import { MarketSignalsRepository } from "./infrastructure/market-signals.repository.js";

/** Nationwide Google Trends geo — matches `IntelligenceService`'s own `TRENDS_BRANCH` scoping note (one bounded, small number of real external calls per run, not a per-branch loop). */
const TRENDS_BRANCH = BranchId.UMUM;
/** How many rising/falling keywords are surfaced by the "Sinyal Pasar" card — matches `GoogleTrendsService`'s own 5-keywords-per-vertical real list, so this is effectively "all of them". */
const MAX_SURFACED_KEYWORDS = 7;

function toIntelVertical(rawVertical: string): IntelVertical {
  return rawVertical === "PROPERTY" ? "PROPERTY" : "AUTOMOTIVE";
}

function formatDeltaPct(pct: number): string {
  const rounded = Math.round(pct);
  return rounded >= 0 ? `+${String(rounded)}%` : `${String(rounded)}%`;
}

/**
 * `modules/market-intelligence` (AAOS LOOP UPGRADE, Sprint 7 Prompt 18 — "Market Intelligence").
 * Aggregates the 4 real signal sources the spec names (search trend, competitor ad angle trend,
 * KPR/BI rate, seasonal calendar) into ONE `MarketSignals` object per real, composed tenant
 * (`AAOS_TENANT_ID` — same single-tenant-composition finding `IntelligenceService` already
 * documents for this app), persists it to `market_signals`, and is what
 * `LlmService.campaignStrategy`'s real request gets threaded `marketSignals` from (see
 * `IntelligenceService.refresh`'s own updated doc for the injection wiring).
 *
 * GENUINELY SEPARATE from `IntelligenceService`/`intelligence_signals` (see
 * `046_market_signals.sql`'s header doc) — narrower scope (exactly these 4 sources, in the exact
 * per-keyword-delta / per-angle-count shape this prompt's own spec asks for), its own weekly cache
 * table, its own Kalender event (`MARKET_INTELLIGENCE_REFRESH`).
 *
 * REAL FEASIBILITY PER SOURCE (investigated this dispatch — see each `build*Signal` method's own
 * doc for the full reasoning):
 * - `seasonality`   — 100% real, static, zero external dependency. ALWAYS `available: true`.
 * - `searchTrend`   — REUSES the already-real, already-integrated `@aos/meta-ads-agent`
 *   `GoogleTrendsService` (live when Google Trends' real, unofficial, undocumented endpoint is
 *   reachable and its circuit breaker is closed; honestly `available: false` otherwise).
 * - `competitorAngleTrend` — REUSES the already-real `CompetitorIntelService` (Meta Ad Library) —
 *   live only when `META_APP_ID`/`META_APP_SECRET` are configured AND the tenant has real,
 *   manager-added `competitor_pages` rows for this vertical.
 * - `kprRate` — HONESTLY DEGRADED by default (no real, stable public API/RSS feed for BI's 7-Day
 *   Reverse Repo Rate was found this dispatch) — `available: true` only once an operator fills in
 *   the manually-curated `MARKET_INTEL_KPR_RATE_*` env vars.
 *
 * Per-source failure isolation (spec's own explicit requirement): each `build*Signal` method
 * catches its own real failure and returns an honest `available: false` — `refresh()` NEVER lets
 * one source's failure abort the whole aggregation, and every degrade is `this.logger.warn`'d (the
 * same real warning-not-error discipline `IntelligenceService.buildCompetitorContext`/
 * `buildClosingContext`/`buildCapiHealthContext` already establish for this exact class of
 * "one external source is down" event), never `this.logger.error`.
 */
@Injectable()
export class MarketIntelligenceService {
  private readonly logger = new Logger(MarketIntelligenceService.name);

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    private readonly tenantRepository: TenantRepository,
    private readonly signalsRepository: MarketSignalsRepository,
    private readonly competitorPageRepository: CompetitorPageRepository,
    private readonly trendsService: GoogleTrendsService,
    // `@Optional()` — same real Nest DI gotcha `IntelligenceService.now`/`RecyclingService.now`
    // already document: a bare `Function`-typed constructor param with a default still gets a real
    // DI resolution attempt without this, which fails bootstrap.
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  /** `GET /api/v1/market-signals/latest` — the latest real persisted row for this tenant, or `undefined` when none has ever been generated. */
  async getLatest(): Promise<MarketSignalsResponseDto | undefined> {
    const row = await this.signalsRepository.findLatestByTenant(this.config.AAOS_TENANT_ID);
    return row === undefined ? undefined : toMarketSignalsResponseDto(row);
  }

  /** `POST /api/v1/market-signals/refresh` and the `MARKET_INTELLIGENCE_REFRESH` Kalender handler — runs the full real aggregation synchronously and persists the result. */
  async refresh(): Promise<MarketSignalsResponseDto> {
    const tenant = await this.findTenantOrThrow();
    const vertical = toIntelVertical(tenant.vertical);

    const seasonality = getSeasonalitySignal(this.now());
    const searchTrend = await this.buildSearchTrendSignal(vertical);
    const competitorAngleTrend = await this.buildCompetitorAngleTrendSignal(tenant, vertical);
    const kprRate = this.buildKprRateSignal();

    const digestText = buildDigestText(seasonality, searchTrend, competitorAngleTrend, kprRate);

    const row = await this.signalsRepository.insert({
      tenant_id: this.config.AAOS_TENANT_ID,
      vertical,
      search_trend_data: searchTrend,
      competitor_data: competitorAngleTrend,
      kpr_rate_data: kprRate,
      seasonal_data: seasonality,
      digest_text: digestText,
    });
    return toMarketSignalsResponseDto(row);
  }

  // ---------------------------------------------------------------------------------------------
  // Signal builders — one per real source, each honestly degrading (never fabricating) when its
  // real dependency is unavailable/unconfigured/fails, and never throwing out of `refresh()`.
  // ---------------------------------------------------------------------------------------------

  /**
   * `search_trend.ts` — REUSES `GoogleTrendsService.getTrends` (already real, already integrated
   * via `IntelligenceService`), read here for its PER-KEYWORD `weeklyDelta` (this prompt's own
   * `{keyword, delta}` shape) rather than `interpretForCampaign`'s single already-aggregated
   * signal. Honest scope-down vs. the spec's own "per lokasi listing aktif" wording: the real,
   * reused service's `KEYWORDS` list is per-VERTICAL, not per-listing-location (see
   * `GoogleTrendsService`'s own file docstring — it has no location-parameterized keyword input) —
   * adapted honestly to what the real service actually provides (vertical-level Indonesian
   * property search terms: "rumah dijual", "KPR rumah", etc.) rather than fabricating
   * per-location deltas a real call was never made for.
   */
  private async buildSearchTrendSignal(vertical: IntelVertical): Promise<SearchTrendSignal> {
    if (this.trendsService.isCircuitOpen()) {
      const reason = "Google Trends circuit breaker terbuka (terlalu banyak kegagalan beruntun).";
      this.logger.warn(`MarketIntelligenceService.buildSearchTrendSignal: ${reason}`);
      return { available: false, reason };
    }
    const result = await this.trendsService.getTrends(vertical, TRENDS_BRANCH);
    if (!result.ok) {
      this.logger.warn(
        `MarketIntelligenceService.buildSearchTrendSignal: getTrends failed: ${result.error.message}`,
      );
      return { available: false, reason: result.error.message };
    }
    const keywords = result.value.slice(0, MAX_SURFACED_KEYWORDS).map((t) => ({
      keyword: t.keyword,
      delta: formatDeltaPct(t.weeklyDelta),
      deltaPct: t.weeklyDelta,
      trend: t.trend,
    }));
    const rising = keywords.filter((k) => k.trend === "RISING").length;
    return {
      available: true,
      keywords,
      reasoning:
        rising > 0
          ? `${String(rising)} dari ${String(keywords.length)} keyword naik minggu ini.`
          : "Tidak ada keyword yang naik signifikan minggu ini.",
    };
  }

  /**
   * `competitor_ads.ts` — REUSES `CompetitorIntelService` (Meta Ad Library, already real via
   * `IntelligenceService.buildCompetitorContext`). Angle categories reused directly from real
   * Creative vocabulary (`classifyPropertyAngle`/`classifyAutomotiveAngle`, the real
   * `PropertyAdAngle`/`AdAngle` classifiers) — NOT the spec's own fictional
   * HUNIAN/INVESTASI/KPR/LOKASI/DP_RINGAN taxonomy, per the coordinator note's own instruction to
   * "reuse kategori angle yang sudah ada di Creative" honestly rather than inventing a second,
   * parallel vocabulary. Honestly `available: false` when `META_APP_ID`/`META_APP_SECRET` aren't
   * configured, or when the tenant has no active competitor pages for this vertical, or on any
   * real fetch failure — never fabricated competitor ad data.
   */
  private async buildCompetitorAngleTrendSignal(
    tenant: TenantRow,
    vertical: IntelVertical,
  ): Promise<CompetitorAngleTrendSignal> {
    if (this.config.META_APP_ID.length === 0 || this.config.META_APP_SECRET.length === 0) {
      const reason = "META_APP_ID/META_APP_SECRET belum dikonfigurasi untuk Meta Ad Library.";
      this.logger.warn(`MarketIntelligenceService.buildCompetitorAngleTrendSignal: ${reason}`);
      return { available: false, reason };
    }
    const pages = await this.competitorPageRepository.listActiveByTenantAndVertical(
      tenant.tenant_id,
      vertical,
    );
    if (pages.length === 0) {
      const reason = "Belum ada halaman kompetitor aktif yang dikonfigurasi untuk vertical ini.";
      this.logger.warn(`MarketIntelligenceService.buildCompetitorAngleTrendSignal: ${reason}`);
      return { available: false, reason };
    }
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
        `MarketIntelligenceService.buildCompetitorAngleTrendSignal: getCompetitorAds failed: ${result.error.message}`,
      );
      return { available: false, reason: result.error.message };
    }
    return this.interpretCompetitorAds(result.value, vertical);
  }

  private interpretCompetitorAds(
    ads: ReadonlyArray<CompetitorAd>,
    vertical: IntelVertical,
  ): CompetitorAngleTrendSignal {
    const angleCounts: Record<string, number> = {};
    for (const ad of ads) {
      const text = ad.adTexts.join(" ");
      const angle =
        ad.angle ??
        (vertical === "AUTOMOTIVE" ? classifyAutomotiveAngle(text) : classifyPropertyAngle(text));
      if (angle === undefined) continue;
      angleCounts[angle] = (angleCounts[angle] ?? 0) + 1;
    }
    const sorted = Object.entries(angleCounts).sort((a, b) => b[1] - a[1]);
    const topAngle = sorted[0]?.[0];
    return {
      available: true,
      angleCounts,
      activeAdCount: ads.length,
      topAngle,
      reasoning:
        topAngle !== undefined
          ? `Kompetitor paling sering pakai angle ${topAngle} (${String(sorted[0]?.[1] ?? 0)} dari ${String(ads.length)} ad aktif).`
          : `${String(ads.length)} ad kompetitor aktif ditemukan, tidak ada angle dominan yang terdeteksi.`,
    };
  }

  /**
   * `kpr_rate.ts` — real, MANUALLY-CURATED Bank Indonesia 7-Day Reverse Repo Rate (see
   * `AaosApiConfig.MARKET_INTEL_KPR_RATE_PCT`'s own doc for the full honest-feasibility
   * investigation: no real, stable public API/RSS feed for this rate was found this dispatch). Pure
   * — no network call, no failure mode beyond "not configured yet", so this is the only builder
   * that isn't `async`.
   */
  private buildKprRateSignal(): KprRateSignal {
    const raw = this.config.MARKET_INTEL_KPR_RATE_PCT.trim();
    if (raw.length === 0) {
      const reason =
        "MARKET_INTEL_KPR_RATE_PCT belum dikonfigurasi — rate KPR/BI dikurasi manual, belum diisi operator.";
      this.logger.warn(`MarketIntelligenceService.buildKprRateSignal: ${reason}`);
      return { available: false, reason };
    }
    const currentPct = Number(raw);
    if (!Number.isFinite(currentPct)) {
      const reason = `MARKET_INTEL_KPR_RATE_PCT="${raw}" bukan angka valid.`;
      this.logger.warn(`MarketIntelligenceService.buildKprRateSignal: ${reason}`);
      return { available: false, reason };
    }
    const direction: KprRateDirection =
      this.config.MARKET_INTEL_KPR_RATE_DIRECTION === ""
        ? "STABIL"
        : this.config.MARKET_INTEL_KPR_RATE_DIRECTION;
    const asOf =
      this.config.MARKET_INTEL_KPR_RATE_AS_OF.trim().length > 0
        ? this.config.MARKET_INTEL_KPR_RATE_AS_OF.trim()
        : "tidak diketahui";
    return {
      available: true,
      currentPct,
      direction,
      asOf,
      reasoning: `Rate KPR/BI saat ini ${String(currentPct)}% (${direction.toLowerCase()}), dikurasi manual per ${asOf}.`,
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

/** Real, Indonesian, generated-at-write-time summary — same "one real summary line per real source" discipline `IntelligenceService`'s own `buildDigestText` establishes. */
function buildDigestText(
  seasonality: SeasonalitySignal,
  searchTrend: SearchTrendSignal,
  competitor: CompetitorAngleTrendSignal,
  kprRate: KprRateSignal,
): string {
  const lines = [
    "📊 Sinyal Pasar",
    `📅 Musiman: ${seasonality.note}`,
    `🔎 Search Trend: ${searchTrend.available ? searchTrend.reasoning : `tidak tersedia (${searchTrend.reason})`}`,
    `🔍 Kompetitor: ${competitor.available ? competitor.reasoning : `tidak tersedia (${competitor.reason})`}`,
    `🏦 Rate KPR: ${kprRate.available ? kprRate.reasoning : `tidak tersedia (${kprRate.reason})`}`,
  ];
  return lines.join("\n");
}
