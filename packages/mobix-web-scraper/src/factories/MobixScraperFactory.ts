import type { IPublisher } from "@aos/event-bus";

import { MobixScraperService } from "../application/services/MobixScraperService.js";
import { DetectInventoryChanges } from "../application/use-cases/DetectInventoryChanges.js";
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
}

const DEFAULT_LISTING_URL = "https://mobixbydss.id/unit";
const DEFAULT_PROMO_URL = "https://mobixbydss.id/promo";

/** Composition root — the single place this package's real integrations (`@aos/event-bus` `IPublisher`, native `fetch`) get wired together, mirroring `@aos/meta-ads-agent`'s `TamaraAgentFactory`. */
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

    return new MobixScraperService(scrapeInventory, scrapePromos, detectInventoryChanges);
  }
}
