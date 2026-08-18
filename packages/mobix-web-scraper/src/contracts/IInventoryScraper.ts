import type { Result } from "@aos/common";

import type { ScrapeSession } from "../domain/entities/ScrapeSession.js";
import type { ParseError } from "../domain/errors/ParseError.js";
import type { ScrapeError } from "../domain/errors/ScrapeError.js";
import type { ScrapeWarningListener } from "../domain/events/ScrapeWarning.js";

/** Fetches the mobixbydss.id inventory listing into a `ScrapeSession`. */
export interface IInventoryScraper {
  /**
   * @param onWarning Optional sink for non-fatal data-quality warnings found in the real response
   * (currently `branch_fallback`). Passed at call time — not construction time — so a warning can be
   * attributed to the specific scrape job that triggered it, mirroring `RunFullScrape`'s
   * `onProgress` convention.
   */
  scrape(
    onWarning?: ScrapeWarningListener,
  ): Promise<Result<ScrapeSession, ScrapeError | ParseError>>;
}
