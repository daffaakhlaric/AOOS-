import type { Result } from "@aos/common";

import type { ScrapeSession } from "../domain/entities/ScrapeSession.js";
import type { ParseError } from "../domain/errors/ParseError.js";
import type { ScrapeError } from "../domain/errors/ScrapeError.js";

/** Fetches + parses the mobixbydss.id inventory listing into a `ScrapeSession`. */
export interface IInventoryScraper {
  scrape(): Promise<Result<ScrapeSession, ScrapeError | ParseError>>;
}
