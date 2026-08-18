import { randomUUID } from "node:crypto";

import { err, ok, type Result } from "@aos/common";

import type { IInventoryScraper } from "../../contracts/IInventoryScraper.js";
import type { ScrapedUnit } from "../../domain/entities/ScrapedUnit.js";
import { ScrapeSession } from "../../domain/entities/ScrapeSession.js";
import { ParseError } from "../../domain/errors/ParseError.js";
import type { ScrapeError } from "../../domain/errors/ScrapeError.js";
import type { ScrapeWarningListener } from "../../domain/events/ScrapeWarning.js";
import { LISTING_API_PATH, postJson, resolveApiOrigin } from "../api/MobixApiClient.js";
import { mobixListingResponseSchema } from "../api/MobixApiSchemas.js";
import { toScrapedUnit } from "../api/MobixUnitMapper.js";

export interface MobixInventoryScraperOptions {
  /**
   * The public listing URL (`https://mobixbydss.id/produk`). Its ORIGIN is what actually matters —
   * the real request goes to `<origin>/api/get-all-produk`. See `resolveApiOrigin`'s docstring for
   * why the API base is derived rather than separately configured.
   */
  readonly listingUrl: string;
  /** Explicit API origin override, bypassing `listingUrl` derivation. Rarely needed. */
  readonly apiBaseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly clock?: () => Date;
  /** Hard cap on pages fetched, purely as a runaway-loop guard. Default 200. */
  readonly maxPages?: number;
}

const DEFAULT_MAX_PAGES = 200;

/**
 * Scrapes mobixbydss.id's inventory by calling its REAL public JSON API
 * (`POST /api/get-all-produk`, body `{"page": N}`) — no HTML, no regex, no headless browser. This
 * replaces the previous HTML-regex implementation (and `UnitListingParser`, now deleted) per
 * `docs/MIGRATION-TO-API.md` step 2: the `IInventoryScraper` contract is unchanged, so
 * `ScrapeInventory`, `DetectInventoryChanges`, `RunFullScrape`, and `MobixScraperService` needed no
 * changes at all.
 *
 * Pagination walks `page = 1, 2, …` while `page <= meta.total_pages`, accumulating each response's
 * `data`. `meta.total_pages` is trusted verbatim rather than computed from `total_data / limit` —
 * the real API's own numbers do not divide evenly (244 items, limit 12, but 14 pages), so a computed
 * bound would scrape the wrong pages.
 *
 * Each item maps through `toScrapedUnit`. A malformed item fails the whole scrape (same discipline
 * as the HTML parser it replaces — silently dropping units would understate real stock), EXCEPT for
 * the genuinely-absent-odometer case, which defaults to 0.
 */
export class MobixInventoryScraper implements IInventoryScraper {
  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => Date;
  private readonly maxPages: number;

  constructor(private readonly options: MobixInventoryScraperOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.clock = options.clock ?? (() => new Date());
    this.maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  }

  async scrape(
    onWarning?: ScrapeWarningListener,
  ): Promise<Result<ScrapeSession, ScrapeError | ParseError>> {
    const startedAt = this.clock();

    const originResult = this.options.apiBaseUrl
      ? resolveApiOrigin(this.options.apiBaseUrl)
      : resolveApiOrigin(this.options.listingUrl);
    if (!originResult.ok) {
      return err(originResult.error);
    }
    const origin = originResult.value;
    const endpoint = `${origin}${LISTING_API_PATH}`;

    const units: ScrapedUnit[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= this.maxPages) {
      const body = await postJson(this.fetchImpl, endpoint, { page }, "MobixInventoryScraper");
      if (!body.ok) {
        return err(body.error);
      }

      const parsed = mobixListingResponseSchema.safeParse(body.value);
      if (!parsed.success) {
        return err(
          new ParseError(
            `MobixInventoryScraper: ${endpoint} page ${String(page)} did not match the expected ` +
              `API response shape: ` +
              parsed.error.issues
                .map((issue) => `${issue.path.join(".")} ${issue.message}`)
                .join("; "),
          ),
        );
      }

      for (const raw of parsed.data.data) {
        const mapped = toScrapedUnit(raw, {
          origin,
          clock: this.clock,
          ...(onWarning !== undefined ? { onWarning } : {}),
        });
        if (!mapped.ok) {
          return err(mapped.error);
        }
        units.push(mapped.value);
      }

      totalPages = parsed.data.meta.total_pages;
      page += 1;
    }

    const sessionResult = ScrapeSession.create({
      sessionId: randomUUID(),
      units,
      startedAt,
      completedAt: this.clock(),
      sourceUrl: endpoint,
    });
    /* v8 ignore next 4 */
    if (!sessionResult.ok) {
      // Unreachable: completedAt is always read after startedAt from a monotonically-advancing clock.
      return err(new ParseError(sessionResult.error.message));
    }
    return ok(sessionResult.value);
  }
}
