import { type Result } from "@aos/common";

import type { IInventoryScraper } from "../../contracts/IInventoryScraper.js";
import type { ScrapeSession } from "../../domain/entities/ScrapeSession.js";
import type { ParseError } from "../../domain/errors/ParseError.js";
import type { ScrapeError } from "../../domain/errors/ScrapeError.js";
import type { MobixScraperEvents } from "../../domain/events/MobixScraperEvents.js";
import type { ScrapeWarningListener } from "../../domain/events/ScrapeWarning.js";

/** Runs one inventory scrape and publishes `ScrapeCompleted`/`ScrapeFailed`. */
export class ScrapeInventory {
  constructor(
    private readonly scraper: IInventoryScraper,
    private readonly events: MobixScraperEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** @param onWarning Forwarded to the scraper — see `IInventoryScraper.scrape`. */
  async execute(
    onWarning?: ScrapeWarningListener,
  ): Promise<Result<ScrapeSession, ScrapeError | ParseError>> {
    const startedAt = this.now();
    const result = await this.scraper.scrape(onWarning);
    if (!result.ok) {
      await this.events.publishScrapeFailed({
        sourceUrl: "",
        reason: result.error.message,
        occurredAt: this.now(),
        version: "1.0",
      });
      return result;
    }
    await this.events.publishScrapeCompleted({
      sessionId: result.value.sessionId,
      unitCount: result.value.unitCount,
      sourceUrl: result.value.sourceUrl,
      durationMs: this.now().getTime() - startedAt.getTime(),
      occurredAt: this.now(),
      version: "1.0",
    });
    return result;
  }
}
