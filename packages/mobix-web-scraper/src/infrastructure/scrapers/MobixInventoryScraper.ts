import { randomUUID } from "node:crypto";

import { err, ok, type Result } from "@aos/common";

import type { IInventoryScraper } from "../../contracts/IInventoryScraper.js";
import { ScrapeSession } from "../../domain/entities/ScrapeSession.js";
import { ParseError } from "../../domain/errors/ParseError.js";
import { ScrapeError } from "../../domain/errors/ScrapeError.js";
import { UnitListingParser } from "../parsers/UnitListingParser.js";

export interface MobixInventoryScraperOptions {
  readonly listingUrl: string;
  readonly fetchImpl?: typeof fetch;
  readonly clock?: () => Date;
}

/**
 * POC only — fetches the mobixbydss.id inventory listing page with native `fetch` and parses it
 * with `UnitListingParser` (regex/string-based, no headless browser). If mobixbydss.id renders
 * client-side, this needs to point `listingUrl` at a `/api/units`-style endpoint instead — see
 * README "Migration path to MobixApiAdapter" for the production replacement plan.
 */
export class MobixInventoryScraper implements IInventoryScraper {
  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => Date;

  constructor(private readonly options: MobixInventoryScraperOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.clock = options.clock ?? (() => new Date());
  }

  async scrape(): Promise<Result<ScrapeSession, ScrapeError | ParseError>> {
    const startedAt = this.clock();
    let response: Response;
    try {
      response = await this.fetchImpl(this.options.listingUrl);
    } catch (error) {
      return err(
        new ScrapeError(`MobixInventoryScraper: fetch failed for ${this.options.listingUrl}`, {
          cause: error instanceof Error ? error : undefined,
        }),
      );
    }
    if (!response.ok) {
      return err(
        new ScrapeError(
          `MobixInventoryScraper: ${this.options.listingUrl} responded with status ${response.status}`,
        ),
      );
    }

    const html = await response.text();
    const parsed = UnitListingParser.parse(html, this.clock);
    if (!parsed.ok) {
      return err(parsed.error);
    }

    const sessionResult = ScrapeSession.create({
      sessionId: randomUUID(),
      units: parsed.value,
      startedAt,
      completedAt: this.clock(),
      sourceUrl: this.options.listingUrl,
    });
    /* v8 ignore next 4 */
    if (!sessionResult.ok) {
      // Unreachable: completedAt is always read after startedAt from a monotonically-advancing clock.
      return err(new ParseError(sessionResult.error.message));
    }
    return ok(sessionResult.value);
  }
}
