import type { UploadAsset } from "@aos/asset-library";
import type { IPublisher } from "@aos/event-bus";

import { MobixScraperService } from "../application/services/MobixScraperService.js";
import { DetectInventoryChanges } from "../application/use-cases/DetectInventoryChanges.js";
import { DownloadAndStorePhotos } from "../application/use-cases/DownloadAndStorePhotos.js";
import { RunFullScrape } from "../application/use-cases/RunFullScrape.js";
import { ScrapeInventory } from "../application/use-cases/ScrapeInventory.js";
import { ScrapePromos } from "../application/use-cases/ScrapePromos.js";
import { MobixScraperEvents } from "../domain/events/MobixScraperEvents.js";
import { MobixInventoryScraper } from "../infrastructure/scrapers/MobixInventoryScraper.js";
import { MobixPromoScraper } from "../infrastructure/scrapers/MobixPromoScraper.js";

export interface MobixScraperFactoryOptions {
  readonly publisher: IPublisher;
  readonly listingUrl?: string;
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
}

const DEFAULT_LISTING_URL = "https://mobixbydss.id/unit";
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

    const inventoryScraper = new MobixInventoryScraper({
      listingUrl: options.listingUrl ?? DEFAULT_LISTING_URL,
      fetchImpl: options.fetchImpl,
      clock: now,
    });
    const promoScraper = new MobixPromoScraper({
      promoUrl: options.promoUrl ?? DEFAULT_PROMO_URL,
      fetchImpl: options.fetchImpl,
      clock: now,
    });

    const scrapeInventory = new ScrapeInventory(inventoryScraper, events, now);
    const scrapePromos = new ScrapePromos(promoScraper, events, now);
    const detectInventoryChanges = new DetectInventoryChanges(events, now);

    const downloadAndStorePhotos = options.uploadAsset
      ? new DownloadAndStorePhotos(
          options.uploadAsset,
          events,
          options.tenantId ?? "default",
          now,
          options.fetchImpl ?? fetch,
          options.photoTimeoutMs,
        )
      : undefined;
    const runFullScrape = new RunFullScrape(
      scrapeInventory,
      detectInventoryChanges,
      downloadAndStorePhotos,
    );

    return new MobixScraperService(
      scrapeInventory,
      scrapePromos,
      detectInventoryChanges,
      runFullScrape,
    );
  }
}
