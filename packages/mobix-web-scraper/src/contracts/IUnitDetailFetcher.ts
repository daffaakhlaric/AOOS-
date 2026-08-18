import type { Result } from "@aos/common";

import type { ParseError } from "../domain/errors/ParseError.js";
import type { ScrapeError } from "../domain/errors/ScrapeError.js";

/** One unit's full detail, as returned by mobixbydss.id's `POST /api/get-detail-produk`. */
export interface UnitDetail {
  readonly slug: string;
  /** The COMPLETE gallery as absolute URLs (~11 per real unit), not just the listing thumbnail. */
  readonly photos: ReadonlyArray<string>;
  /** The unit's marketing copy (`deskripsi`), when present. */
  readonly description?: string;
}

/**
 * Fetches ONE unit's full detail by slug — the real replacement for what would have been a
 * "detail page scrape". Kept as its own narrow port (rather than widening `IInventoryScraper`)
 * because the listing and detail endpoints are genuinely separate API calls with different
 * lifetimes: the listing is scraped wholesale every run, a detail is fetched per NEW unit only.
 */
export interface IUnitDetailFetcher {
  fetchDetail(slug: string): Promise<Result<UnitDetail, ScrapeError | ParseError>>;
}
