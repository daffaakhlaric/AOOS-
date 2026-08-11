import type { Result } from "@aos/common";

import type { IPromoScraper } from "../../contracts/IPromoScraper.js";
import type { ScrapedPromo } from "../../domain/entities/ScrapedPromo.js";
import type { ParseError } from "../../domain/errors/ParseError.js";
import type { ScrapeError } from "../../domain/errors/ScrapeError.js";
import type { MobixScraperEvents } from "../../domain/events/MobixScraperEvents.js";

/** Runs one promo scrape and publishes `PromoDetected` per promo found, or `ScrapeFailed` on error. */
export class ScrapePromos {
  constructor(
    private readonly scraper: IPromoScraper,
    private readonly events: MobixScraperEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<Result<ReadonlyArray<ScrapedPromo>, ScrapeError | ParseError>> {
    const result = await this.scraper.scrape();
    if (!result.ok) {
      await this.events.publishScrapeFailed({
        sourceUrl: "",
        reason: result.error.message,
        occurredAt: this.now(),
        version: "1.0",
      });
      return result;
    }
    for (const promo of result.value) {
      await this.events.publishPromoDetected({
        title: promo.title,
        validUntil: promo.validUntil?.toISOString(),
        occurredAt: this.now(),
        version: "1.0",
      });
    }
    return result;
  }
}
