import type { Result } from "@aos/common";

import type { ScrapedPromo } from "../domain/entities/ScrapedPromo.js";
import type { ParseError } from "../domain/errors/ParseError.js";
import type { ScrapeError } from "../domain/errors/ScrapeError.js";

/** Fetches + parses the mobixbydss.id promo page into a list of `ScrapedPromo`. */
export interface IPromoScraper {
  scrape(): Promise<Result<ReadonlyArray<ScrapedPromo>, ScrapeError | ParseError>>;
}
