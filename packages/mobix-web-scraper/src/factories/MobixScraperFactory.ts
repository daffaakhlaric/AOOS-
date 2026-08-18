import type { UploadAsset } from "@aos/asset-library";
import type { IPublisher } from "@aos/event-bus";

import { MobixScraperService } from "../application/services/MobixScraperService.js";
import { DetectInventoryChanges } from "../application/use-cases/DetectInventoryChanges.js";
import { DownloadAndStorePhotos } from "../application/use-cases/DownloadAndStorePhotos.js";
import { RunFullScrape } from "../application/use-cases/RunFullScrape.js";
import { ScrapeInventory } from "../application/use-cases/ScrapeInventory.js";
import { ScrapePromos } from "../application/use-cases/ScrapePromos.js";
import { ScrapeUnit } from "../application/use-cases/ScrapeUnit.js";
import type { IScrapedUnitRepository } from "../contracts/IScrapedUnitRepository.js";
import { MobixScraperEvents } from "../domain/events/MobixScraperEvents.js";
import { MobixInventoryScraper } from "../infrastructure/scrapers/MobixInventoryScraper.js";
import { MobixPromoScraper } from "../infrastructure/scrapers/MobixPromoScraper.js";
import { MobixUnitDetailFetcher } from "../infrastructure/scrapers/MobixUnitDetailFetcher.js";
import { ScrapedUnitRepository } from "../infrastructure/supabase/ScrapedUnitRepository.js";
import { createSupabaseClient } from "../infrastructure/supabase/SupabaseClient.js";

export interface MobixScraperFactoryOptions {
  readonly publisher: IPublisher;
  /**
   * The public listing URL, e.g. `https://mobixbydss.id/produk`. Since AAOS-SCRAPER-API-MIGRATION
   * the inventory scraper derives the real JSON API base from this URL's ORIGIN
   * (`<origin>/api/get-all-produk`, `<origin>/api/get-detail-produk`) rather than fetching this URL
   * directly — see `resolveApiOrigin`. Override `apiBaseUrl` to decouple the two.
   */
  readonly listingUrl?: string;
  /** Explicit JSON-API origin, when it differs from `listingUrl`'s origin. Rarely needed. */
  readonly apiBaseUrl?: string;
  /** The promo page — still real HTML, still parsed by `PromoParser` (no promo JSON API exists). */
  readonly promoUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
  /**
   * The real `@aos/asset-library` `UploadAsset` use case (from `AssetLibraryFactory.create(...)
   * .uploadAsset`) — supplying it wires up `DownloadAndStorePhotos`/`RunFullScrape`'s photo
   * ingestion for real. Omitted entirely, `RunFullScrape` still works (scrape + diff), it just
   * skips the photo step — see `RunFullScrape`'s own docstring.
   */
  readonly uploadAsset?: UploadAsset;
  /** Required alongside `uploadAsset` — forwarded to every `UploadAsset.execute()` call. Ignored (and photo ingestion never runs) when `uploadAsset` is omitted. */
  readonly tenantId?: string;
  /** Per-photo download timeout in ms, passed to `DownloadAndStorePhotos`. Default 15000. */
  readonly photoTimeoutMs?: number;
  /**
   * AAOS-SCRAPER-ASSET-LIBRARY — Supabase project backing the new `scraped_units` table (the SAME
   * project/keys every other AAOS package uses; see
   * `supabase/migrations/001_scraped_units.sql`). Supply BOTH to get durable unit persistence and
   * working `getStockList()`/`searchByModel()`/`getStockStats()`; omit both and the scraper still
   * runs exactly as before (scrape + diff + photo ingestion), with those read methods returning an
   * explicit `err` rather than a misleading empty list.
   */
  readonly supabaseUrl?: string;
  readonly supabaseServiceKey?: string;
  /** Pre-built repository, primarily for tests — takes precedence over `supabaseUrl`/`supabaseServiceKey`. */
  readonly scrapedUnitRepository?: IScrapedUnitRepository;
}

const DEFAULT_LISTING_URL = "https://mobixbydss.id/produk";
const DEFAULT_PROMO_URL = "https://mobixbydss.id/promo";

/**
 * Composition root — the single place this package's real integrations (`@aos/event-bus`
 * `IPublisher`, native `fetch`, and now `@aos/asset-library`'s `UploadAsset`) get wired together,
 * mirroring `@aos/meta-ads-agent`'s `TamaraAgentFactory`. Still returns a `MobixScraperService`
 * (never a wider bundle) so existing callers — `@aos/meta-ads-agent`'s `TamaraAgentFactory`, which
 * calls `.scrapeInventoryUnits()`/`.scrapePromosList()` directly on the returned value — keep
 * working unchanged; the new `RunFullScrape`/`DownloadAndStorePhotos` capability is reached via
 * the service's new `runFullScrape()` method instead of a different return shape.
 */
export class MobixScraperFactory {
  static create(options: MobixScraperFactoryOptions): MobixScraperService {
    const now = options.now ?? (() => new Date());
    const events = new MobixScraperEvents(options.publisher);
    const tenantId = options.tenantId ?? "default";

    const inventoryScraper = new MobixInventoryScraper({
      listingUrl: options.listingUrl ?? DEFAULT_LISTING_URL,
      ...(options.apiBaseUrl !== undefined ? { apiBaseUrl: options.apiBaseUrl } : {}),
      fetchImpl: options.fetchImpl,
      clock: now,
    });
    const promoScraper = new MobixPromoScraper({
      promoUrl: options.promoUrl ?? DEFAULT_PROMO_URL,
      fetchImpl: options.fetchImpl,
      clock: now,
    });
    // Fetches each unit's FULL `galeri` from the real detail endpoint. Always constructed (it is
    // cheap and stateless); it only ever performs a request when `DownloadAndStorePhotos` — i.e. a
    // configured `uploadAsset` — actually asks for a unit's gallery.
    const unitDetailFetcher = new MobixUnitDetailFetcher({
      listingUrl: options.listingUrl ?? DEFAULT_LISTING_URL,
      ...(options.apiBaseUrl !== undefined ? { apiBaseUrl: options.apiBaseUrl } : {}),
      ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
    });

    const scrapeInventory = new ScrapeInventory(inventoryScraper, events, now);
    const scrapePromos = new ScrapePromos(promoScraper, events, now);
    const detectInventoryChanges = new DetectInventoryChanges(events, now);

    const downloadAndStorePhotos = options.uploadAsset
      ? new DownloadAndStorePhotos(
          options.uploadAsset,
          events,
          tenantId,
          now,
          options.fetchImpl ?? fetch,
          options.photoTimeoutMs,
          unitDetailFetcher,
        )
      : undefined;

    // AAOS-SCRAPER-ASSET-LIBRARY: durable `scraped_units` persistence, wired only when the caller
    // actually configured a Supabase project for it — same optional-collaborator discipline as
    // `uploadAsset` above.
    const scrapedUnitRepository =
      options.scrapedUnitRepository ??
      (options.supabaseUrl !== undefined &&
      options.supabaseUrl.length > 0 &&
      options.supabaseServiceKey !== undefined &&
      options.supabaseServiceKey.length > 0
        ? new ScrapedUnitRepository(
            createSupabaseClient(options.supabaseUrl, options.supabaseServiceKey),
          )
        : undefined);

    const runFullScrape = new RunFullScrape(
      scrapeInventory,
      detectInventoryChanges,
      downloadAndStorePhotos,
      scrapedUnitRepository,
      tenantId,
    );
    const scrapeUnit = new ScrapeUnit(
      scrapeInventory,
      downloadAndStorePhotos,
      scrapedUnitRepository,
      tenantId,
    );

    return new MobixScraperService(
      scrapeInventory,
      scrapePromos,
      detectInventoryChanges,
      runFullScrape,
      scrapeUnit,
      scrapedUnitRepository,
      tenantId,
    );
  }
}
