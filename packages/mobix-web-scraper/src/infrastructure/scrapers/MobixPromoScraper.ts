import { err, ok, type Result } from "@aos/common";

import type { IPromoScraper } from "../../contracts/IPromoScraper.js";
import type { ScrapedPromo } from "../../domain/entities/ScrapedPromo.js";
import type { ParseError } from "../../domain/errors/ParseError.js";
import { ScrapeError } from "../../domain/errors/ScrapeError.js";
import { PromoParser } from "../parsers/PromoParser.js";

export interface MobixPromoScraperOptions {
  readonly promoUrl: string;
  readonly fetchImpl?: typeof fetch;
  readonly clock?: () => Date;
}

/**
 * POC only — fetches the mobixbydss.id promo page with native `fetch` and parses it with
 * `PromoParser` (regex/string-based, no headless browser). Same client-side-rendering caveat as
 * `MobixInventoryScraper` — see README.
 */
export class MobixPromoScraper implements IPromoScraper {
  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => Date;

  constructor(private readonly options: MobixPromoScraperOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.clock = options.clock ?? (() => new Date());
  }

  async scrape(): Promise<Result<ReadonlyArray<ScrapedPromo>, ScrapeError | ParseError>> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.options.promoUrl);
    } catch (error) {
      return err(
        new ScrapeError(`MobixPromoScraper: fetch failed for ${this.options.promoUrl}`, {
          cause: error instanceof Error ? error : undefined,
        }),
      );
    }
    if (!response.ok) {
      return err(
        new ScrapeError(
          `MobixPromoScraper: ${this.options.promoUrl} responded with status ${response.status}`,
        ),
      );
    }

    const html = await response.text();
    const parsed = PromoParser.parse(html, this.clock);
    if (!parsed.ok) {
      return err(parsed.error);
    }
    return ok(parsed.value);
  }
}
