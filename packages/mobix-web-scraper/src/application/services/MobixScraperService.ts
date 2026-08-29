import { err, ok, type Result } from "@aos/common";

import type {
  IScrapedUnitRepository,
  ScrapedUnitListFilter,
  ScrapedUnitPage,
  ScrapedUnitStats,
} from "../../contracts/IScrapedUnitRepository.js";
import type { ScrapedPromo } from "../../domain/entities/ScrapedPromo.js";
import type { ScrapedUnit } from "../../domain/entities/ScrapedUnit.js";
import type { ScrapeSession } from "../../domain/entities/ScrapeSession.js";
import type { ParseError } from "../../domain/errors/ParseError.js";
import { ScrapeError } from "../../domain/errors/ScrapeError.js";
import type { DetectInventoryChanges, InventoryDiff } from "../use-cases/DetectInventoryChanges.js";
import type {
  RunFullScrape,
  RunFullScrapeResult,
  ScrapeProgressListener,
} from "../use-cases/RunFullScrape.js";
import type { ScrapeInventory } from "../use-cases/ScrapeInventory.js";
import type { ScrapePromos } from "../use-cases/ScrapePromos.js";
import type { ScrapeUnit, ScrapeUnitResult } from "../use-cases/ScrapeUnit.js";

/** Options accepted by `getStockList` — `page`/`limit` default to the first 50 units. */
export interface GetStockListOptions {
  readonly branch?: ScrapedUnitListFilter["branch"];
  readonly available?: boolean;
  readonly search?: string;
  readonly page?: number;
  readonly limit?: number;
}

const DEFAULT_STOCK_LIMIT = 50;

function noRepository(method: string): ScrapeError {
  return new ScrapeError(
    `MobixScraperService.${method}: factory was not composed with an IScrapedUnitRepository ` +
      `(supply supabaseUrl/supabaseServiceKey to MobixScraperFactory.create), so no persisted ` +
      `stock is available`,
  );
}

/**
 * Facade over the underlying use cases — the single object `@aos/meta-ads-agent`'s
 * `SamanthaAgentFactory.createWithFullContext()` depends on for S2 (per the combined-supplement
 * spec's `Promise.all([...])` init sequence). Keeps its own last-session state in memory (so a
 * second `scrapeInventory()` call — or `runFullScrape()` — can diff against the previous one).
 *
 * AAOS-SCRAPER-ASSET-LIBRARY: the read methods below (`getStockList`, `getUnitPhotos`,
 * `searchByModel`, `getStockStats`) are backed by the new DURABLE `scraped_units` table via
 * `IScrapedUnitRepository`, NOT by the in-memory `lastSession` — a dashboard request must return
 * real stock regardless of whether this process happens to have run a scrape since booting. When no
 * repository was wired in, they return an explicit `err` explaining that (never an empty list
 * pretending the dealer has no stock).
 */
export class MobixScraperService {
  private lastSession: ScrapeSession | undefined;

  constructor(
    private readonly scrapeInventory: ScrapeInventory,
    private readonly scrapePromos: ScrapePromos,
    private readonly detectInventoryChanges: DetectInventoryChanges,
    private readonly fullScrape?: RunFullScrape,
    private readonly singleUnitScrape?: ScrapeUnit,
    private readonly scrapedUnitRepository?: IScrapedUnitRepository,
    private readonly tenantId: string = "dss-motor",
  ) {}

  /** Matches the composed-object method name `@aos/meta-ads-agent`'s `createWithFullContext()` calls. */
  async scrapeInventoryUnits(): Promise<
    Result<ReadonlyArray<ScrapedUnit>, ScrapeError | ParseError>
  > {
    const result = await this.scrapeInventory.execute();
    if (!result.ok) {
      return result;
    }
    this.lastSession = result.value;
    return { ok: true, value: result.value.units };
  }

  async scrapePromosList(): Promise<Result<ReadonlyArray<ScrapedPromo>, ScrapeError | ParseError>> {
    return this.scrapePromos.execute();
  }

  /** Diffs the most recently scraped session against the one before it. No-ops (empty diff) until at least two scrapes have run. */
  async detectChanges(current: ScrapeSession): Promise<Result<InventoryDiff, never>> {
    const previous = this.lastSession;
    const diff = await this.detectInventoryChanges.execute(previous, current);
    this.lastSession = current;
    return diff;
  }

  get lastScrapedSession(): ScrapeSession | undefined {
    return this.lastSession;
  }

  /**
   * Runs a full scrape → diff → (new-unit) photo-ingestion → persist cycle via `RunFullScrape`,
   * diffing against — and then replacing — this service's own remembered `lastScrapedSession`,
   * exactly like `detectChanges()` already does. Only available when the factory composed a
   * `RunFullScrape` (always the case via `MobixScraperFactory.create` — photo ingestion and
   * `scraped_units` persistence are each skipped gracefully, not this whole method, when their
   * optional dependency wasn't supplied; see `RunFullScrape`'s own docstring).
   *
   * `onProgress` receives real pipeline milestones (`ScrapeProgressEvent`) — used by
   * `apps/aaos-api`'s scrape-job service to write real log rows for the dashboard's progress modal.
   */
  async runFullScrape(
    correlationId?: string,
    onProgress?: ScrapeProgressListener,
  ): Promise<Result<RunFullScrapeResult, ScrapeError | ParseError>> {
    if (!this.fullScrape) {
      return err(
        new ScrapeError(
          "MobixScraperService.runFullScrape: factory was not composed with a RunFullScrape use case",
        ),
      );
    }
    const result = await this.fullScrape.execute(this.lastSession, correlationId, onProgress);
    if (result.ok) {
      this.lastSession = result.value.session;
    }
    return result;
  }

  /** Re-scrapes and re-ingests ONE unit — see `ScrapeUnit`'s docstring for what "one unit" really costs (it re-fetches the listing page). */
  async scrapeUnit(
    unitUrl: string,
    correlationId?: string,
  ): Promise<Result<ScrapeUnitResult, ScrapeError | ParseError>> {
    if (!this.singleUnitScrape) {
      return err(
        new ScrapeError(
          "MobixScraperService.scrapeUnit: factory was not composed with a ScrapeUnit use case",
        ),
      );
    }
    return this.singleUnitScrape.execute(unitUrl, correlationId);
  }

  /** Paginated persisted stock, newest-scraped first. Reads `scraped_units` — never the in-memory session. */
  async getStockList(
    options: GetStockListOptions = {},
  ): Promise<Result<ScrapedUnitPage, ScrapeError>> {
    if (!this.scrapedUnitRepository) {
      return err(noRepository("getStockList"));
    }
    return this.scrapedUnitRepository.list({
      tenantId: this.tenantId,
      ...(options.branch !== undefined ? { branch: options.branch } : {}),
      ...(options.available !== undefined ? { available: options.available } : {}),
      ...(options.search !== undefined ? { search: options.search } : {}),
      page: options.page ?? 1,
      limit: options.limit ?? DEFAULT_STOCK_LIMIT,
    });
  }

  /** One persisted unit by its `identityKey` (URL slug), or `undefined` when it was never scraped. */
  async getUnit(identityKey: string): Promise<Result<ScrapedUnit | undefined, ScrapeError>> {
    if (!this.scrapedUnitRepository) {
      return err(noRepository("getUnit"));
    }
    return this.scrapedUnitRepository.findByIdentityKey(identityKey, this.tenantId);
  }

  /**
   * The SOURCE photo URLs recorded for one unit on mobixbydss.id. Note these are the original
   * listing URLs, not the GCS-stored copies — those are `@aos/asset-library` `assets` rows
   * (`type: UNIT_PHOTO`, `unit_id` = this same `identityKey`) and are read through the asset
   * library's own `listAssets`, not through this package (which owns scraping, not asset queries).
   * Returns an `err` for an unknown unit rather than an empty list, so a caller can tell "unit not
   * scraped" apart from "unit scraped but had no photos".
   */
  async getUnitPhotos(identityKey: string): Promise<Result<readonly string[], ScrapeError>> {
    const found = await this.getUnit(identityKey);
    if (!found.ok) {
      return err(found.error);
    }
    if (found.value === undefined) {
      return err(
        new ScrapeError(`MobixScraperService.getUnitPhotos: no scraped unit "${identityKey}"`),
      );
    }
    return ok(found.value.photos);
  }

  /** Substring (case-insensitive) model search over persisted stock — the Scraper page's "Cari unit…" box. */
  async searchByModel(
    model: string,
    options: Omit<GetStockListOptions, "search"> = {},
  ): Promise<Result<ScrapedUnitPage, ScrapeError>> {
    return this.getStockList({ ...options, search: model });
  }

  /** Aggregate persisted-stock counts for the Scraper page's KPI strip. */
  async getStockStats(): Promise<Result<ScrapedUnitStats, ScrapeError>> {
    if (!this.scrapedUnitRepository) {
      return err(noRepository("getStockStats"));
    }
    return this.scrapedUnitRepository.getStats(this.tenantId);
  }
}
