import { BranchId } from "@aos/branch-manager";
import { ErrorCode, err, ok, type Result } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";
import { z } from "zod";

import { AdAngle } from "../domain/value-objects/AdAngle.js";

import type { IntelVertical } from "./SeasonalCalendarService.js";

const TRENDS_BASE_URL = "https://trends.google.com/trends/api";
const EXPLORE_URL = `${TRENDS_BASE_URL}/explore`;
const WIDGETDATA_MULTILINE_URL = `${TRENDS_BASE_URL}/widgetdata/multiline`;
/**
 * Google Trends' real, undocumented comparison limit: the `explore` UI (and its underlying
 * `comparisonItem` payload) refuses more than 5 keywords in a single comparison request — same
 * "batch into the API's real hard limit" discipline as `CompetitorIntelService`'s
 * `MAX_PAGE_IDS_PER_REQUEST` for Meta's real 10-page-ID limit.
 */
const MAX_KEYWORDS_PER_REQUEST = 5;
/**
 * Short timeout by design: this endpoint is undocumented/unofficial and either responds quickly
 * or has already started throttling/blocking — waiting long for it serves no one, see file
 * docstring's degraded-mode section.
 */
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_TIMEFRAME = "today 3-m";
/** Google's `tz` param: negative minutes-offset-from-UTC (`-(localOffsetHours * 60)`). WIB is UTC+7. */
const WIB_TZ_OFFSET_MINUTES = -420;
const DEFAULT_HL = "id";
/**
 * Circuit-breaker judgment call (see file docstring): open after this many CONSECUTIVE
 * whole-call failures (network/timeout/malformed-response — never "keyword had no data", which
 * is a legitimate ok result and never counts as a failure).
 */
const DEFAULT_CIRCUIT_BREAKER_THRESHOLD = 3;
/** Skip all real network calls for this long once the circuit opens. */
const DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS = 15 * 60 * 1000;
/** A >= 15% week-over-week move is treated as a real trend direction; smaller moves are noise. */
const TREND_DELTA_THRESHOLD_PCT = 15;

/**
 * AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 3 ("Source 2: Google Trends"). Real, external, but
 * UNOFFICIAL and UNSUPPORTED Google endpoint — fundamentally different reliability posture than
 * Phase 2's `CompetitorIntelService` (a real, documented, stable Meta API with a support
 * contract). `trends.google.com/trends/api` has no published spec, no SLA, no versioning
 * guarantee, and is known to rate-limit/block aggressively per-IP. Every design choice in this
 * file follows the coordinator note's point 2 instruction: "build it to degrade honestly, don't
 * treat it as always-available."
 *
 * ## Research: what's real, current (checked 2026-08-24), and why this shape was chosen
 *
 * 1. **Existing implementation vs. from-scratch scrape.** `pytrends`
 *    (github.com/GeneralMills/pytrends) is the long-standing, widely-used open-source
 *    reverse-engineering of this exact endpoint — its request/response shapes are the
 *    battle-tested reference this file follows (its own README/source was read directly, not a
 *    stale blog post). HOWEVER: pytrends' GitHub repo was archived (read-only) on 2026-04-17 —
 *    it is not currently maintained, and multiple 2026 sources (`dev.to/esteban_ortega`'s
 *    "pytrends Is Dead" post, `apiserpent.com`'s equivalent) describe it as no longer reliably
 *    tracking Google's changes. Decision: reuse pytrends' VERIFIED real endpoint URLs, param
 *    names, and response-parsing logic (read directly from `pytrends/request.py`'s
 *    `build_payload`/`_tokens`/`interest_over_time` — not guessed) as this file's reference
 *    shape, rather than depending on the (Python, unmaintained, and this is a TypeScript
 *    monorepo) package itself. This is the same "verify against a real, current, authoritative
 *    source, don't copy the spec's pseudocode" discipline `CompetitorIntelService` documents for
 *    Meta's docs — here the authoritative source is a real, working, widely-relied-upon
 *    open-source implementation rather than an official doc page, because Google publishes none.
 * 2. **Real two-step flow.** There is no single-call "get trend for keyword" endpoint. The real
 *    flow is: (a) `POST /trends/api/explore` with `hl`, `tz`, and a `req` JSON string containing
 *    `comparisonItem` (one `{keyword, time, geo}` entry per keyword, up to 5 — see
 *    `MAX_KEYWORDS_PER_REQUEST`), `category`, `property`; the response's `widgets` array contains
 *    one entry per Google Trends UI panel (`TIMESERIES`, `GEO_MAP`, `RELATED_TOPICS`,
 *    `RELATED_QUERIES`), each carrying a short-lived `token` + `request` object. (b)
 *    `GET /trends/api/widgetdata/multiline` with that `TIMESERIES` widget's `token`/`request`
 *    (as `req`), returning `{ default: { timelineData: [{ time, value: number[], isPartial? }] } }`
 *    — one `value` array entry per keyword in the same order as `comparisonItem`.
 * 3. **The `)]}'` anti-XSSI prefix is real and current.** Multiple independently-written 2026
 *    scraping write-ups (`dev.to/vladimir_triphonov`, `scrapfly.io/blog/how-to-scrape-google-trends`)
 *    confirm both endpoints still prefix every response body with a junk string before the real
 *    JSON starts, specifically to break a naive `JSON.parse`/`.json()` call. This file strips
 *    everything up to the FIRST `{` character rather than hardcoding a fixed character count
 *    (pytrends hardcodes `trim_chars=4` for explore and `=5` for widgetdata — brittle if Google
 *    ever changes the exact prefix text/length again, which it has done before) — a more robust
 *    choice for an endpoint with zero stability guarantee.
 * 4. **Rate limiting is real and aggressive.** `dev.to/vladimir_triphonov`'s write-up (a 2026,
 *    hands-on account) reports roughly 10-15 requests tolerated per source IP before 429s start,
 *    and recommends IP rotation as "mandatory, not optional" for any sustained use. This service
 *    deliberately does NOT attempt IP rotation, proxy pooling, or the documented
 *    `batchexecute`-endpoint NID-cookie warm-up step some scrapers use to reduce 429 odds — all
 *    real, out-of-scope infrastructure concerns for a low-volume (at most a few calls per branch
 *    per day) backend signal source, not a high-volume scraper. Instead this file leans entirely
 *    on the degraded-mode/circuit-breaker design below: expect 429s/blocks to happen sometimes,
 *    detect them cheaply, and skip out rather than fight them.
 * 5. **Keyword batching.** Google's own `explore` comparison UI hard-caps comparisons at 5
 *    keywords — `MAX_KEYWORDS_PER_REQUEST` chunks each vertical's keyword list (7 keywords) into
 *    groups of <= 5, mirroring `CompetitorIntelService`'s `chunk()` helper for Meta's real
 *    10-page-ID limit.
 * 6. **`relatedQueries` is deliberately dropped from this pass's `TrendsData`** (present in the
 *    spec's pseudocode). Fetching it needs a THIRD real network call per chunk (the
 *    `RELATED_QUERIES` widget's own `widgetdata/relatedsearches` request) on top of the two this
 *    file already makes — given point 4's real rate-limit ceiling, adding a 50% more network
 *    load for a field `interpretForCampaign`'s spec logic never actually reads is not worth the
 *    extra failure surface. Flagged here as an explicit, documented scope-down rather than a
 *    silent omission; a real implementation is a small, mechanical addition to `fetchChunk` if a
 *    future caller needs it.
 *
 * ## Degraded-mode design (the PRIMARY concern of this file, not an afterthought)
 *
 * - **Timeout**: `DEFAULT_TIMEOUT_MS` (10s) per HTTP call via `AbortController`, matching
 *   `CompetitorIntelService`'s pattern — short by design (see const docstring above).
 * - **Two distinct "no signal" shapes, never conflated**:
 *   - A keyword with `hasData: false` in its `TrendsData` — Google Trends genuinely has no
 *     interest-over-time data for that keyword/geo combination (all-zero or empty
 *     `timelineData`). This is a legitimate, ok, per-keyword RESULT, included in the returned
 *     array like any other.
 *   - `Result.err(GoogleTrendsError)` for the WHOLE `getTrends` call — the endpoint itself is
 *     unreachable, timed out, blocked (429/403), or returned a shape this file can't parse
 *     (missing `TIMESERIES` widget, non-JSON body after prefix-stripping, schema mismatch). Same
 *     fail-the-whole-call-on-any-chunk-failure discipline as `CompetitorIntelService`, for the
 *     same reason: a caller must never read a short/partial keyword list as "these keywords
 *     genuinely have low interest" when it might really mean "half the chunks got blocked".
 * - **Circuit breaker** (in-process, per `GoogleTrendsService` instance): after
 *   `DEFAULT_CIRCUIT_BREAKER_THRESHOLD` (3) CONSECUTIVE whole-call failures, further calls
 *   short-circuit to `Result.err` for `DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS` (15 min) WITHOUT
 *   making any network request — a deliberate judgment call given point 4's documented
 *   rate-limiting behavior: retrying a blocked IP immediately just burns more of its already
 *   scarce request budget and delays whatever cooldown Google itself is enforcing. A single
 *   keyword's `hasData: false` never counts toward the breaker; only whole-call failures do. Any
 *   success resets the consecutive-failure counter and closes the breaker immediately.
 */
export class GoogleTrendsError extends AosError {
  constructor(
    message: string,
    options: AosErrorOptions = {},
    code: ErrorCode = ErrorCode.UNAVAILABLE,
  ) {
    super(code, message, options);
  }
}

/** Keywords per vertical — spec's own list, unchanged (already real, unremarkable Indonesian search terms). */
const KEYWORDS: Record<IntelVertical, ReadonlyArray<string>> = {
  AUTOMOTIVE: [
    "jual beli mobil bekas",
    "kredit mobil bekas",
    "mobil bekas murah",
    "xpander bekas",
    "hrv bekas",
    "avanza bekas",
    "dp mobil",
  ],
  PROPERTY: [
    "rumah dijual",
    "KPR rumah",
    "properti investasi",
    "rumah murah",
    "apartemen dijual",
    "dp rumah",
    "cicilan rumah",
  ],
};

/**
 * Real ISO 3166-2 Google Trends `geo` codes for the 4 real `BranchId` members (verified against
 * ISO 3166-2:ID, checked 2026-08-24: `ID-BT` = Banten province, `ID-JB` = Jawa Barat/West Java
 * province — the spec's codes were correct, this just cites the verification). `BINTARO` and
 * `CINERE` are both Tangerang Selatan-area branches physically within Banten province, so both
 * map to the same provincial code (Google Trends has no sub-provincial `geo` granularity for
 * Indonesia). `UMUM` (no specific physical branch — see `BranchId`'s own docstring) maps to
 * nationwide `'ID'`.
 */
const BRANCH_GEO: Record<BranchId, string> = {
  [BranchId.BINTARO]: "ID-BT",
  [BranchId.CINERE]: "ID-BT",
  [BranchId.BANDUNG]: "ID-JB",
  [BranchId.UMUM]: "ID",
};

export type TrendDirection = "RISING" | "STABLE" | "FALLING";

export interface TrendsData {
  readonly keyword: string;
  /** 0-100, Google's own normalized scale (100 = that keyword/geo/timeframe's peak). Latest available data point. */
  readonly relativeInterest: number;
  readonly trend: TrendDirection;
  /** % change of the latest data point vs. the one before it. `0` when `hasData` is `false` or there's only one data point. */
  readonly weeklyDelta: number;
  /** `false` = Google Trends returned no real interest-over-time data for this keyword/geo — a legitimate empty result, NOT a fetch failure (see file docstring). */
  readonly hasData: boolean;
}

export interface TrendSignal {
  readonly shouldScaleBudget: boolean;
  readonly suggestedAngle: AdAngle | string;
  readonly reasoning: string;
}

const ExploreWidgetSchema = z.object({
  id: z.string(),
  token: z.string(),
  request: z.unknown(),
});

const ExploreResponseSchema = z.object({
  widgets: z.array(ExploreWidgetSchema),
});

const TimelineDataPointSchema = z.object({
  time: z.string(),
  value: z.array(z.number()),
  isPartial: z.boolean().optional(),
});

const WidgetDataResponseSchema = z.object({
  default: z.object({
    timelineData: z.array(TimelineDataPointSchema),
  }),
});

type ExploreResponse = z.infer<typeof ExploreResponseSchema>;
type WidgetDataResponse = z.infer<typeof WidgetDataResponseSchema>;

function chunk<T>(items: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** Strips Google's real `)]}'`-style anti-XSSI prefix by dropping everything before the first `{` — see file docstring item 3 for why this is more robust than a hardcoded character count. */
function stripAntiXssiPrefix(text: string): string {
  const braceIndex = text.indexOf("{");
  return braceIndex === -1 ? text : text.slice(braceIndex);
}

export interface GoogleTrendsServiceOptions {
  readonly timeoutMs?: number;
  readonly timeframe?: string;
  readonly circuitBreakerThreshold?: number;
  readonly circuitBreakerCooldownMs?: number;
  /** Injectable `fetch` implementation — defaults to the global native `fetch`; overridable for tests. */
  readonly fetchImpl?: typeof fetch;
  /** Injectable clock for circuit-breaker cooldown tests. */
  readonly now?: () => number;
}

export class GoogleTrendsService {
  private readonly timeoutMs: number;
  private readonly timeframe: string;
  private readonly circuitBreakerThreshold: number;
  private readonly circuitBreakerCooldownMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(options: GoogleTrendsServiceOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.timeframe = options.timeframe ?? DEFAULT_TIMEFRAME;
    this.circuitBreakerThreshold =
      options.circuitBreakerThreshold ?? DEFAULT_CIRCUIT_BREAKER_THRESHOLD;
    this.circuitBreakerCooldownMs =
      options.circuitBreakerCooldownMs ?? DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => Date.now());
  }

  /** Real ISO 3166-2 `geo` code for `branch` — see `BRANCH_GEO`'s docstring. */
  static branchToGeo(branch: BranchId): string {
    return BRANCH_GEO[branch];
  }

  /** `true` while the circuit breaker is open (see file docstring) — exposed so callers can skip scheduling this source entirely without paying even the "return an error" cost. */
  isCircuitOpen(): boolean {
    return this.now() < this.circuitOpenUntil;
  }

  /**
   * Fetches real interest-over-time signals for every keyword in `vertical`'s real keyword list,
   * scoped to `branch`'s real geo. Batches keywords into groups of `MAX_KEYWORDS_PER_REQUEST` (5,
   * Google's real comparison limit). Fails fast: any chunk's network failure, timeout, non-2xx
   * response, or unparseable/schema-invalid body returns `Result.err` for the WHOLE call (see
   * file docstring's degraded-mode section) — never a silent partial keyword list.
   */
  async getTrends(
    vertical: IntelVertical,
    branch: BranchId,
  ): Promise<Result<ReadonlyArray<TrendsData>, GoogleTrendsError>> {
    if (this.isCircuitOpen()) {
      return err(
        new GoogleTrendsError(
          "Google Trends circuit breaker is open (too many recent consecutive failures) — skipping this call.",
        ),
      );
    }

    const geo = GoogleTrendsService.branchToGeo(branch);
    const keywordChunks = chunk(KEYWORDS[vertical], MAX_KEYWORDS_PER_REQUEST);

    const results: TrendsData[] = [];
    for (const keywords of keywordChunks) {
      const chunkResult = await this.fetchChunk(keywords, geo);
      if (!chunkResult.ok) {
        this.recordFailure();
        return chunkResult;
      }
      results.push(...chunkResult.value);
    }

    this.recordSuccess();
    return ok(results);
  }

  private recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.circuitBreakerThreshold) {
      this.circuitOpenUntil = this.now() + this.circuitBreakerCooldownMs;
    }
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitOpenUntil = 0;
  }

  private async fetchChunk(
    keywords: ReadonlyArray<string>,
    geo: string,
  ): Promise<Result<ReadonlyArray<TrendsData>, GoogleTrendsError>> {
    const exploreResult = await this.fetchExplore(keywords, geo);
    if (!exploreResult.ok) {
      return exploreResult;
    }

    const timeseriesWidget = exploreResult.value.widgets.find((w) => w.id === "TIMESERIES");
    if (timeseriesWidget === undefined) {
      return err(
        new GoogleTrendsError(
          "Google Trends explore response had no TIMESERIES widget — unexpected response shape.",
        ),
      );
    }

    const widgetDataResult = await this.fetchWidgetData(
      timeseriesWidget.token,
      timeseriesWidget.request,
    );
    if (!widgetDataResult.ok) {
      return widgetDataResult;
    }

    return ok(this.toTrendsData(keywords, widgetDataResult.value));
  }

  private toTrendsData(
    keywords: ReadonlyArray<string>,
    response: WidgetDataResponse,
  ): ReadonlyArray<TrendsData> {
    const { timelineData } = response.default;

    return keywords.map((keyword, index) => {
      const values = timelineData
        .map((point) => point.value[index])
        .filter((v): v is number => v !== undefined);

      if (values.length === 0 || values.every((v) => v === 0)) {
        return { keyword, relativeInterest: 0, trend: "STABLE", weeklyDelta: 0, hasData: false };
      }

      const latest = values[values.length - 1] as number;
      const previous = values.length >= 2 ? (values[values.length - 2] as number) : undefined;
      const weeklyDelta =
        previous === undefined || previous === 0 ? 0 : ((latest - previous) / previous) * 100;

      const trend: TrendDirection =
        weeklyDelta > TREND_DELTA_THRESHOLD_PCT
          ? "RISING"
          : weeklyDelta < -TREND_DELTA_THRESHOLD_PCT
            ? "FALLING"
            : "STABLE";

      return { keyword, relativeInterest: latest, trend, weeklyDelta, hasData: true };
    });
  }

  private async fetchExplore(
    keywords: ReadonlyArray<string>,
    geo: string,
  ): Promise<Result<ExploreResponse, GoogleTrendsError>> {
    const req = JSON.stringify({
      comparisonItem: keywords.map((keyword) => ({ keyword, time: this.timeframe, geo })),
      category: 0,
      property: "",
    });
    const url = new URL(EXPLORE_URL);
    url.searchParams.set("hl", DEFAULT_HL);
    url.searchParams.set("tz", String(WIB_TZ_OFFSET_MINUTES));
    url.searchParams.set("req", req);

    const bodyResult = await this.doFetch(url);
    if (!bodyResult.ok) {
      return bodyResult;
    }
    return this.parseBody(bodyResult.value, ExploreResponseSchema, "explore");
  }

  private async fetchWidgetData(
    token: string,
    request: unknown,
  ): Promise<Result<WidgetDataResponse, GoogleTrendsError>> {
    const url = new URL(WIDGETDATA_MULTILINE_URL);
    url.searchParams.set("req", JSON.stringify(request));
    url.searchParams.set("token", token);
    url.searchParams.set("tz", String(WIB_TZ_OFFSET_MINUTES));

    const bodyResult = await this.doFetch(url);
    if (!bodyResult.ok) {
      return bodyResult;
    }
    return this.parseBody(bodyResult.value, WidgetDataResponseSchema, "widgetdata");
  }

  private async doFetch(url: URL): Promise<Result<string, GoogleTrendsError>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url.toString(), {
        method: "GET",
        signal: controller.signal,
      });
      if (!response.ok) {
        return err(
          new GoogleTrendsError(
            `Google Trends API request failed with HTTP ${String(response.status)}`,
            { context: { httpStatus: response.status } },
            response.status === 429 ? ErrorCode.RATE_LIMITED : ErrorCode.UNAVAILABLE,
          ),
        );
      }
      return ok(await response.text());
    } catch (cause) {
      const isTimeout = cause instanceof Error && cause.name === "AbortError";
      return err(
        new GoogleTrendsError(
          isTimeout
            ? `Google Trends API request timed out after ${String(this.timeoutMs)}ms`
            : `Google Trends API network failure: ${describeCause(cause)}`,
          { cause },
        ),
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseBody<T>(
    rawText: string,
    schema: z.ZodType<T>,
    label: string,
  ): Result<T, GoogleTrendsError> {
    const stripped = stripAntiXssiPrefix(rawText);
    let json: unknown;
    try {
      json = JSON.parse(stripped);
    } catch (cause) {
      return err(
        new GoogleTrendsError(
          `Google Trends API ${label} response was not parseable JSON after prefix-stripping: ${describeCause(cause)}`,
          { cause },
        ),
      );
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return err(
        new GoogleTrendsError(`Google Trends API ${label} response failed schema validation`, {
          context: { zodError: parsed.error },
        }),
      );
    }
    return ok(parsed.data);
  }
}

/**
 * The spec's `interpretForCampaign` — pure interpretation over already-fetched `trends`.
 * `topKeyword` is the highest-`relativeInterest` entry; `undefined`/empty `trends` yields a
 * neutral, honest "no data" signal rather than throwing (the spec's pseudocode read
 * `trends.sort(...)[0].relativeInterest` unguarded, which throws on an empty array).
 */
export function interpretForCampaign(
  trends: ReadonlyArray<TrendsData>,
  vertical: IntelVertical,
): TrendSignal {
  if (trends.length === 0) {
    return {
      shouldScaleBudget: false,
      suggestedAngle: vertical === "AUTOMOTIVE" ? AdAngle.TESTIMONIAL : "TESTIMONIAL",
      reasoning: "Tidak ada data Google Trends yang tersedia.",
    };
  }

  const rising = trends.filter((t) => t.trend === "RISING");
  const topKeyword = [...trends].sort(
    (a, b) => b.relativeInterest - a.relativeInterest,
  )[0] as TrendsData;

  return {
    shouldScaleBudget: topKeyword.relativeInterest > 70,
    suggestedAngle: trendToAngle(rising, vertical),
    reasoning: `"${topKeyword.keyword}" interest: ${String(topKeyword.relativeInterest)}/100, ${topKeyword.trend}`,
  };
}

/**
 * The spec's `trendToAngle`, corrected onto real enum members (spec's `DP_RINGAN`/`PRICE_FOCUS`/
 * `INVESTASI`/`BRAND_AWARENESS` target names don't all exist in either real vertical's angle
 * vocabulary — same "map to the closest real member, document the reasoning" discipline
 * `SeasonalCalendarService`'s own docstring established):
 *
 * - `dp`/`kredit`/`cicilan` rising → real `DP_RINGAN` (literal match, exists in both `AdAngle`
 *   and `PropertyAdAngle`).
 * - `murah` (spec's fictional `PRICE_FOCUS`) rising → AUTOMOTIVE: real `GUDANGNYA` (no real
 *   `AdAngle` member is about price at all; `GUDANGNYA`'s real copy, per
 *   `CompetitorIntelService`'s own classification, is about abundant AVAILABLE stock — read here
 *   as "lots of affordable options to browse", the closest real angle to a price-conscious
 *   searcher's intent). PROPERTY: real `PROMO_TERBATAS` — a direct reuse of
 *   `CompetitorIntelService.classifyPropertyAngle`'s own `murah`-adjacent
 *   `promo|diskon|terbatas` → `PROMO_TERBATAS` mapping, the same real sibling file's precedent.
 * - `investasi` rising → PROPERTY only (AUTOMOTIVE's keyword list has no "investasi" term): real
 *   `INVESTASI` (literal match). AUTOMOTIVE has no case for this branch by construction.
 * - Default (spec's fictional `BRAND_AWARENESS`, nothing specific rising) → real `TESTIMONIAL`
 *   for BOTH verticals — the same trust/awareness-building fallback
 *   `SeasonalCalendarService`'s own YEAREND event picks for AUTOMOTIVE, and a real member of
 *   both enums, so the choice is symmetric across verticals.
 */
export function trendToAngle(
  rising: ReadonlyArray<TrendsData>,
  vertical: IntelVertical,
): AdAngle | string {
  const risingKeywords = rising.map((r) => r.keyword);
  const matchesAny = (needles: ReadonlyArray<string>): boolean =>
    risingKeywords.some((kw) => needles.some((needle) => kw.includes(needle)));

  if (matchesAny(["dp", "kredit", "cicilan"])) {
    return vertical === "AUTOMOTIVE" ? AdAngle.DP_RINGAN : "DP_RINGAN";
  }
  if (vertical === "PROPERTY" && matchesAny(["investasi"])) {
    return "INVESTASI";
  }
  if (matchesAny(["murah"])) {
    return vertical === "AUTOMOTIVE" ? AdAngle.GUDANGNYA : "PROMO_TERBATAS";
  }
  return vertical === "AUTOMOTIVE" ? AdAngle.TESTIMONIAL : "TESTIMONIAL";
}
