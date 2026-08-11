import type { Result } from "@aos/common";

import type { ScrapedPromo } from "../../domain/entities/ScrapedPromo.js";
import type { ScrapedUnit } from "../../domain/entities/ScrapedUnit.js";
import type { ScrapeSession } from "../../domain/entities/ScrapeSession.js";
import type { ParseError } from "../../domain/errors/ParseError.js";
import type { ScrapeError } from "../../domain/errors/ScrapeError.js";
import type { DetectInventoryChanges, InventoryDiff } from "../use-cases/DetectInventoryChanges.js";
import type { ScrapeInventory } from "../use-cases/ScrapeInventory.js";
import type { ScrapePromos } from "../use-cases/ScrapePromos.js";

/**
 * Facade over the three use cases — the single object `@aos/meta-ads-agent`'s
 * `TamaraAgentFactory.createWithFullContext()` depends on for S2 (per the combined-supplement
 * spec's `Promise.all([...])` init sequence). Keeps its own last-session state in memory only
 * (no persistence), so a second `scrapeInventory()` call can diff against the first.
 */
export class MobixScraperService {
  private lastSession: ScrapeSession | undefined;

  constructor(
    private readonly scrapeInventory: ScrapeInventory,
    private readonly scrapePromos: ScrapePromos,
    private readonly detectInventoryChanges: DetectInventoryChanges,
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
}
