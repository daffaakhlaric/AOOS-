import { ErrorCode, err, ok, type Result } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";
import { z } from "zod";

import { AdAngle } from "../domain/value-objects/AdAngle.js";

import type { IntelVertical } from "./SeasonalCalendarService.js";

const GRAPH_BASE_URL = "https://graph.facebook.com";
const DEFAULT_API_VERSION = "v21.0";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_REACHED_COUNTRIES: readonly string[] = ["ID"];
const DEFAULT_AD_ACTIVE_STATUS: AdActiveStatus = "ACTIVE";
/** Meta's real, documented limit: "You can provide up to ten IDs, separated by commas" for `search_page_ids`. */
const MAX_PAGE_IDS_PER_REQUEST = 10;
/** An angle seen on 3+ distinct competitor ads is treated as "saturated" (spec's own threshold, kept). */
const SATURATION_THRESHOLD = 3;

export type AdActiveStatus = "ACTIVE" | "ALL" | "INACTIVE";

/**
 * AAOS-TAMARA-INTELLIGENCE-LAYER Phase 2 ("Source 4: Meta Ad Library — kompetitor"). Real,
 * external, public Meta API — verified against Meta's current documentation before writing this
 * file (same discipline `MetaOAuthClient`/`MetaGraphApiTypes.ts` already established this
 * session), NOT copied from the spec's unverified pseudocode. Sources consulted (all fetched
 * 2026-08-24):
 *
 * 1. `developers.facebook.com/docs/marketing-api/reference/ads_archive` — the real base
 *    endpoint is `GET https://graph.facebook.com/{version}/ads_archive`. `ad_reached_countries`
 *    is the only REQUIRED param (`array<enum>` of ISO country codes or `ALL`); `search_page_ids`
 *    (`array<int64>`, "up to ten IDs, separated by commas" — a real hard limit, see
 *    `MAX_PAGE_IDS_PER_REQUEST`) and `ad_active_status` (enum `ACTIVE|ALL|INACTIVE`, defaults to
 *    `ACTIVE`) are optional filters. The spec's pseudocode had `search_page_ids` right (comma
 *    form) but its `ad_reached_countries=['ID']` (bare, unencoded array-literal string) was only
 *    an illustrative curl example, not the real query-string encoding — this client sends a
 *    proper JSON array (`JSON.stringify(countries)`, e.g. `["ID"]`) through `URLSearchParams`,
 *    which Meta's Graph API accepts as valid `array<enum>` param encoding.
 * 2. `developers.facebook.com/docs/marketing-api/reference/archived-ad` — the real response node
 *    is `ArchivedAd`, NOT the spec's fictional flat `id, ad_creative_body, call_to_action_type,
 *    publisher_platforms` shape. Real fields used here: `id`, `page_id`, `page_name`,
 *    `ad_creative_bodies` (a LIST of strings — "the text which displays in each unique ad card",
 *    plural/array, not the spec's singular `ad_creative_body`), `ad_delivery_start_time`,
 *    `ad_delivery_stop_time`, `publisher_platforms`, `ad_snapshot_url`. There is NO documented
 *    `call_to_action_type` field on `ArchivedAd` — the spec's `callToAction` is dropped rather
 *    than fabricated against a field that doesn't exist in the real reference.
 * 3. Access token: the endpoint takes a plain `access_token` query param — confirmed real formats
 *    are an App Access Token (`{app-id}|{app-secret}`, Meta's documented
 *    `facebook-login/guides/access-tokens` convention — see `buildAppAccessToken` below) or a
 *    User/System-User access token carrying the `ads_read` permission. The spec's inline comment
 *    ("App access token, no user login needed") is directionally right — an App Access Token
 *    does work here and needs no per-request user OAuth — but is NOT the whole story: Meta
 *    additionally requires the CALLING DEVELOPER ACCOUNT to have completed a one-time identity/
 *    location confirmation ("facebook.com/ID") before `ads_archive` will serve real data at all
 *    (a real, out-of-band account-level prerequisite this client cannot satisfy or check itself —
 *    it is an operational/account setup step the tenant's engineering team must complete once,
 *    not a per-call parameter).
 * 4. IMPORTANT REAL COVERAGE CAVEAT, load-bearing for how callers should read empty results:
 *    `ads_archive`'s documented scope is NOT "every ad on Facebook/Instagram". It reliably
 *    returns (a) ads about social issues/elections/politics, delivered anywhere, going back
 *    several years, and (b) as of the EU Digital Services Act taking effect, ads of ANY type
 *    delivered into the EU/UK within roughly the past year. Ordinary commercial ads (an
 *    automotive dealer's or property portal's everyday DP/promo creative) reaching ONLY
 *    Indonesia — this service's real use case — sit outside both of those guaranteed-coverage
 *    buckets. A genuinely empty `data: []` response for an Indonesia-only competitor Page is
 *    therefore an EXPECTED, non-error outcome this API can legitimately produce even while that
 *    competitor is actively running ads visible in the ordinary Ad Library web UI — it must never
 *    be read by callers as strong evidence "this competitor isn't advertising". This is exactly
 *    the honest-unavailable-state discipline the coordinator note's point 5 asked for, applied to
 *    a source-level coverage gap rather than only to outright fetch failures.
 *
 * HTTP-client-weight judgment call, mirroring `MetaOAuthClient`'s own documented reasoning: this
 * is a read-only, low-volume, interactive/scheduled lookup (a handful of competitor Pages, run at
 * most a few times a day) — never a high-volume publishing/insights-sync loop. A `fetch`-based
 * client with the same `Result<T,E>`/never-throw/Zod-validated-response discipline is kept as a
 * plain class here, with NO rate-limiter/retry package composition (`meta-organic-connector`'s
 * heavier `IRateLimiter`/`ExponentialBackoffRetry` machinery is built for exactly the
 * high-volume/write-heavy case this call is not).
 */
export class CompetitorIntelError extends AosError {
  constructor(
    message: string,
    options: AosErrorOptions = {},
    code: ErrorCode = ErrorCode.UNAVAILABLE,
  ) {
    super(code, message, options);
  }
}

/**
 * A tenant-configured competitor Facebook/Instagram Page to look up, matching the coordinator
 * note's real, later `competitor_pages` DB table concept — deliberately just an explicit
 * caller-supplied input here (no hardcoded page IDs; the spec's placeholder `'100063...'` IDs are
 * not real businesses' real page IDs and are not reproduced anywhere in this file).
 */
export interface CompetitorPageConfig {
  readonly name: string;
  readonly pageId: string;
  readonly vertical: IntelVertical;
}

/**
 * One real `ArchivedAd` from the Ad Library, narrowed to the fields this service uses. `angle` is
 * the real underlying string value of whichever real enum matched (`AdAngle` for AUTOMOTIVE,
 * `@aos/creative-agent`'s `PropertyAdAngle` values — as plain strings, see
 * `SeasonalCalendarService`'s own documented reasoning for why PROPERTY stays untyped-string here
 * — for PROPERTY), `undefined` when no real angle's keywords matched.
 */
export interface CompetitorAd {
  readonly id: string;
  readonly pageId: string;
  readonly advertiserName: string;
  readonly vertical: IntelVertical;
  /** Real `ad_creative_bodies` — one entry per unique ad card's body text; may be empty. */
  readonly adTexts: ReadonlyArray<string>;
  readonly platforms: ReadonlyArray<string>;
  readonly startDate: string | undefined;
  readonly snapshotUrl: string | undefined;
  readonly angle: string | undefined;
}

export interface CompetitorSignal {
  /** Real angle values seen on `>= saturationThreshold` distinct competitor ads. */
  readonly saturatedAngles: ReadonlyArray<string>;
  /** Real angle values (for `vertical`) seen on ZERO competitor ads — an opportunity signal. */
  readonly unusedAngles: ReadonlyArray<string>;
  readonly topCompetitorAngle: string | undefined;
  readonly reasoning: string;
}

/**
 * All 8 real `PropertyAdAngle` string values, kept byte-identical without importing the enum — see
 * `SeasonalCalendarService`'s file docstring for why this package can't depend on
 * `@aos/creative-agent`. Exported (Phase 4) so `apps/aaos-api`'s new `intelligence` module can
 * build the REAL `productAngleValues` vocabulary it sends to `LlmService.campaignStrategy` for the
 * PROPERTY vertical, without re-declaring this list a third time.
 */
export const ALL_PROPERTY_ANGLE_VALUES: readonly string[] = [
  "DP_RINGAN",
  "READY_HUNI",
  "INVESTASI",
  "EXCLUSIVE",
  "SYARIAH",
  "PROMO_TERBATAS",
  "TESTIMONIAL",
  "VIRTUAL_TOUR",
];

/** All 7 real `AdAngle` enum values — exported (Phase 4) for the same reason as `ALL_PROPERTY_ANGLE_VALUES` above, for the AUTOMOTIVE vertical. */
export const ALL_AUTOMOTIVE_ANGLE_VALUES: readonly string[] = Object.values(AdAngle);

const AdArchiveEntrySchema = z.object({
  id: z.string(),
  page_id: z.string(),
  page_name: z.string().optional(),
  ad_creative_bodies: z.array(z.string()).optional(),
  ad_delivery_start_time: z.string().optional(),
  ad_delivery_stop_time: z.string().optional(),
  publisher_platforms: z.array(z.string()).optional(),
  ad_snapshot_url: z.string().optional(),
});

const AdArchiveResponseSchema = z.object({
  data: z.array(AdArchiveEntrySchema),
});

type AdArchiveEntry = z.infer<typeof AdArchiveEntrySchema>;

/**
 * Classifies an AUTOMOTIVE competitor ad's text against real `AdAngle` members (7, see
 * `packages/meta-ads-agent/src/domain/value-objects/AdAngle.ts`). Regex intent is kept close to
 * the spec's own (DP/financing/stock/trust/etc.) but retargeted onto the real enum instead of the
 * spec's fictional `STOK_TERBATAS`/`BRAND_TRUST`/`KREDIT_MUDAH`/`BRAND_GENERAL` names. `undefined`
 * (never a fabricated `OTHER` member — `AdAngle` has none) when nothing matches.
 */
export function classifyAutomotiveAngle(text: string): AdAngle | undefined {
  if (/syariah/i.test(text)) return AdAngle.KREDIT_SYARIAH;
  if (/\bdp\b|uang muka|down ?payment|cicilan|kredit|angsuran/i.test(text))
    return AdAngle.DP_RINGAN;
  if (/stok|ready ?stock|tersedia|showroom|pilihan lengkap|puluhan unit/i.test(text))
    return AdAngle.GUDANGNYA;
  if (/terpercaya|testimoni|ulasan|pelanggan puas|kepuasan/i.test(text)) return AdAngle.TESTIMONIAL;
  if (/tanya|konsultasi|chat (dulu|kami)|faq/i.test(text)) return AdAngle.QNA;
  if (/jelajah|koleksi|lihat semua unit|cek unit|katalog/i.test(text)) return AdAngle.DISCOVERY;
  if (/kunjungi website|klik link|link di bio|website kami/i.test(text))
    return AdAngle.WEBSITE_REDIRECT;
  return undefined;
}

/**
 * Classifies a PROPERTY competitor ad's text against real `PropertyAdAngle` string values (8, see
 * `packages/creative-agent/src/domain/value-objects/PropertyAdAngle.ts`). Returns a plain string
 * (not the enum type — see `ALL_PROPERTY_ANGLE_VALUES`'s docstring) or `undefined`.
 */
export function classifyPropertyAngle(text: string): string | undefined {
  if (/syariah/i.test(text)) return "SYARIAH";
  if (/\bdp\b|uang muka|cicilan ringan|cicilan mulai/i.test(text)) return "DP_RINGAN";
  if (/virtual tour|tur virtual|360°?|walkthrough/i.test(text)) return "VIRTUAL_TOUR";
  if (/ready|siap huni|serah terima|bisa langsung huni/i.test(text)) return "READY_HUNI";
  if (/investasi|capital gain|nilai jual|instrumen investasi/i.test(text)) return "INVESTASI";
  if (/eksklusif|premium|elite|limited edition/i.test(text)) return "EXCLUSIVE";
  if (/promo|diskon|terbatas|buruan|penawaran spesial/i.test(text)) return "PROMO_TERBATAS";
  if (/terpercaya|testimoni|kepuasan pelanggan/i.test(text)) return "TESTIMONIAL";
  return undefined;
}

function chunk<T>(items: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export interface CompetitorIntelServiceOptions {
  /** An App Access Token (`{app-id}|{app-secret}`, see `buildAppAccessToken`) or a User/System-User token carrying `ads_read`. */
  readonly accessToken: string;
  readonly apiVersion?: string;
  /** ISO country codes (or `ALL`) for the required `ad_reached_countries` param. Defaults to `["ID"]`. */
  readonly reachedCountries?: ReadonlyArray<string>;
  readonly adActiveStatus?: AdActiveStatus;
  readonly timeoutMs?: number;
  /** Injectable `fetch` implementation — defaults to the global native `fetch`; overridable for tests. */
  readonly fetchImpl?: typeof fetch;
}

export class CompetitorIntelService {
  private readonly apiVersion: string;
  private readonly reachedCountries: ReadonlyArray<string>;
  private readonly adActiveStatus: AdActiveStatus;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: CompetitorIntelServiceOptions) {
    this.apiVersion = options.apiVersion ?? DEFAULT_API_VERSION;
    this.reachedCountries = options.reachedCountries ?? DEFAULT_REACHED_COUNTRIES;
    this.adActiveStatus = options.adActiveStatus ?? DEFAULT_AD_ACTIVE_STATUS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** Real Meta App Access Token convention: `{app-id}|{app-secret}` — see class docstring item 3. */
  static buildAppAccessToken(appId: string, appSecret: string): string {
    return `${appId}|${appSecret}`;
  }

  /**
   * Fetches real, currently-`ad_active_status`-matching ads for every given competitor Page,
   * classified by real angle per `pages`' own `vertical`. Batches `search_page_ids` into groups
   * of `MAX_PAGE_IDS_PER_REQUEST` (Meta's real 10-ID limit). Fails fast and honestly: any chunk's
   * network failure, non-2xx response, or schema-validation failure returns `Result.err` for the
   * WHOLE call rather than silently returning a partial list indistinguishable from "all
   * competitors fetched cleanly, all show zero ads" — see class docstring item 4 for why that
   * distinction matters to downstream strategy decisions. An empty `pages` list short-circuits to
   * `Result.ok([])` with no network call.
   */
  async getCompetitorAds(
    pages: ReadonlyArray<CompetitorPageConfig>,
  ): Promise<Result<ReadonlyArray<CompetitorAd>, CompetitorIntelError>> {
    if (pages.length === 0) {
      return ok([]);
    }

    const pageById = new Map(pages.map((page) => [page.pageId, page]));
    const chunks = chunk(pages, MAX_PAGE_IDS_PER_REQUEST);

    const chunkResults = await Promise.all(chunks.map((c) => this.fetchChunk(c)));

    const allAds: CompetitorAd[] = [];
    for (const result of chunkResults) {
      if (!result.ok) {
        return result;
      }
      for (const entry of result.value) {
        const page = pageById.get(entry.page_id);
        // A page_id the API returned that isn't one we asked about would be a real API
        // inconsistency, not expected in practice — skip rather than fabricate a config entry.
        if (page === undefined) {
          continue;
        }
        const adTexts = entry.ad_creative_bodies ?? [];
        const combinedText = adTexts.join(" ");
        const angle =
          page.vertical === "AUTOMOTIVE"
            ? classifyAutomotiveAngle(combinedText)
            : classifyPropertyAngle(combinedText);
        allAds.push({
          id: entry.id,
          pageId: entry.page_id,
          advertiserName: page.name,
          vertical: page.vertical,
          adTexts,
          platforms: entry.publisher_platforms ?? [],
          startDate: entry.ad_delivery_start_time,
          snapshotUrl: entry.ad_snapshot_url,
          angle,
        });
      }
    }

    return ok(allAds);
  }

  private async fetchChunk(
    pages: ReadonlyArray<CompetitorPageConfig>,
  ): Promise<Result<ReadonlyArray<AdArchiveEntry>, CompetitorIntelError>> {
    const url = new URL(`${GRAPH_BASE_URL}/${this.apiVersion}/ads_archive`);
    url.searchParams.set("search_page_ids", pages.map((p) => p.pageId).join(","));
    url.searchParams.set("ad_reached_countries", JSON.stringify(this.reachedCountries));
    url.searchParams.set("ad_active_status", this.adActiveStatus);
    url.searchParams.set(
      "fields",
      "id,page_id,page_name,ad_creative_bodies,ad_delivery_start_time,ad_delivery_stop_time,publisher_platforms,ad_snapshot_url",
    );
    url.searchParams.set("access_token", this.options.accessToken);

    const responseResult = await this.doFetch(url);
    if (!responseResult.ok) {
      return responseResult;
    }
    const parsed = await this.parseBody(responseResult.value);
    if (!parsed.ok) {
      return parsed;
    }
    return ok(parsed.value.data);
  }

  private async doFetch(url: URL): Promise<Result<Response, CompetitorIntelError>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url.toString(), {
        method: "GET",
        signal: controller.signal,
      });
      if (!response.ok) {
        return err(await this.toCompetitorIntelError(response));
      }
      return ok(response);
    } catch (cause) {
      return err(
        new CompetitorIntelError(`Meta Ad Library API network failure: ${describeCause(cause)}`, {
          cause,
        }),
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseBody(
    response: Response,
  ): Promise<Result<z.infer<typeof AdArchiveResponseSchema>, CompetitorIntelError>> {
    let json: unknown;
    try {
      json = await response.json();
    } catch (cause) {
      return err(
        new CompetitorIntelError(
          `Meta Ad Library API returned a non-JSON response body: ${describeCause(cause)}`,
          { cause },
        ),
      );
    }
    const parsed = AdArchiveResponseSchema.safeParse(json);
    if (!parsed.success) {
      return err(
        new CompetitorIntelError("Meta Ad Library API response failed schema validation", {
          context: { zodError: parsed.error },
        }),
      );
    }
    return ok(parsed.data);
  }

  private async toCompetitorIntelError(response: Response): Promise<CompetitorIntelError> {
    let message = `Meta Ad Library API request failed with HTTP ${response.status}`;
    try {
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof (body as { error: unknown }).error === "object" &&
        (body as { error: { message?: unknown } }).error !== null
      ) {
        const nested = (body as { error: { message?: unknown } }).error.message;
        if (typeof nested === "string") {
          message = nested;
        }
      }
    } catch {
      // Non-JSON error body — fall back to the generic HTTP-status-only message above.
    }
    const code =
      response.status === 401 || response.status === 400
        ? ErrorCode.UNAUTHORIZED
        : ErrorCode.UNAVAILABLE;
    return new CompetitorIntelError(message, { context: { httpStatus: response.status } }, code);
  }

  /**
   * Pure interpretation over already-fetched `ads` (spec's `interpretForStrategy`), scoped to one
   * `vertical` (mixed-vertical `ads` arrays are filtered internally by each entry's own
   * `vertical`). `saturatedAngles`/`unusedAngles` are computed against the REAL, full member list
   * for that vertical (`ALL_AUTOMOTIVE_ANGLE_VALUES/ALL_PROPERTY_ANGLE_VALUES`), never the spec's
   * fictional angle vocabulary.
   */
  static interpretForStrategy(
    ads: ReadonlyArray<CompetitorAd>,
    vertical: IntelVertical,
  ): CompetitorSignal {
    const relevant = ads.filter((ad) => ad.vertical === vertical);
    const allAngles =
      vertical === "AUTOMOTIVE" ? ALL_AUTOMOTIVE_ANGLE_VALUES : ALL_PROPERTY_ANGLE_VALUES;

    const angleCounts = new Map<string, number>();
    for (const ad of relevant) {
      if (ad.angle === undefined) {
        continue;
      }
      angleCounts.set(ad.angle, (angleCounts.get(ad.angle) ?? 0) + 1);
    }

    const saturatedAngles = [...angleCounts.entries()]
      .filter(([, count]) => count >= SATURATION_THRESHOLD)
      .map(([angle]) => angle);

    const unusedAngles = allAngles.filter((angle) => !angleCounts.has(angle));

    const topEntry = [...angleCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topCompetitorAngle = topEntry?.[0];

    const reasoning =
      relevant.length === 0
        ? "Tidak ada data ad kompetitor untuk vertical ini."
        : unusedAngles.length > 0
          ? `Kompetitor belum pakai angle ${unusedAngles[0]} — opportunity!`
          : "Semua angle sudah dipakai kompetitor, coba angle brand awareness.";

    return { saturatedAngles, unusedAngles, topCompetitorAngle, reasoning };
  }
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
