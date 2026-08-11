import { err, type Result } from "@aos/common";

import type { ScrapedPromo } from "../../domain/entities/ScrapedPromo.js";
import type { ScrapedUnit } from "../../domain/entities/ScrapedUnit.js";
import type { ScrapeSession } from "../../domain/entities/ScrapeSession.js";
import type { ParseError } from "../../domain/errors/ParseError.js";
import { ScrapeError } from "../../domain/errors/ScrapeError.js";
import type { DetectInventoryChanges, InventoryDiff } from "../use-cases/DetectInventoryChanges.js";
import type { RunFullScrape, RunFullScrapeResult } from "../use-cases/RunFullScrape.js";
import type { ScrapeInventory } from "../use-cases/ScrapeInventory.js";
import type { ScrapePromos } from "../use-cases/ScrapePromos.js";

/**
 * Facade over the underlying use cases — the single object `@aos/meta-ads-agent`'s
 * `TamaraAgentFactory.createWithFullContext()` depends on for S2 (per the combined-supplement
 * spec's `Promise.all([...])` init sequence). Keeps its own last-session state in memory only
 * (no persistence), so a second `scrapeInventory()` call — or `runFullScrape()` — can diff
 * against the previous one.
 */
export class MobixScraperService {
  private lastSession: ScrapeSession | undefined;

  constructor(
    private readonly scrapeInventory: ScrapeInventory,
    private readonly scrapePromos: ScrapePromos,
    private readonly detectInventoryChanges: DetectInventoryChanges,
    private readonly fullScrape?: RunFullScrape,
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
   * Runs a full scrape → diff → (new-unit) photo-ingestion cycle via `RunFullScrape`, diffing
   * against — and then replacing — this service's own remembered `lastScrapedSession`, exactly
   * like `detectChanges()` already does. Only available when the factory composed a
   * `RunFullScrape` (always the case via `MobixScraperFactory.create` — photo ingestion itself is
   * skipped gracefully, not this whole method, when no `@aos/asset-library` dependency was
   * supplied; see `RunFullScrape`'s own docstring).
   */
  async runFullScrape(
    correlationId?: string,
  ): Promise<Result<RunFullScrapeResult, ScrapeError | ParseError>> {
    if (!this.fullScrape) {
      return err(
        new ScrapeError(
          "MobixScraperService.runFullScrape: factory was not composed with a RunFullScrape use case",
        ),
      );
    }
    const result = await this.fullScrape.execute(this.lastSession, correlationId);
    if (result.ok) {
      this.lastSession = result.value.session;
    }
    return result;
  }
}
