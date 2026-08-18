import type { Branch } from "@aos/meta-ads-connector";

/**
 * A non-fatal data-quality problem found in a REAL mobixbydss.id API response — something that did
 * not fail the scrape but that a human should still see. Threaded out of the scraper via
 * `ScrapeWarningListener` (the same execute-time-callback convention as `RunFullScrape`'s
 * `ScrapeProgressListener`) rather than swallowed or `console.warn`-ed.
 */
export type ScrapeWarning = {
  /** The unit's `cabang` had no `@aos/meta-ads-connector` `Branch` member — see `normalizeCabang`. */
  readonly type: "branch_fallback";
  /** The raw `cabang` string exactly as the API returned it, e.g. `"PONDOK BAMBU"` or `"hq3"`. */
  readonly rawCabang: string;
  /** The unit this happened on, so the warning is actionable. */
  readonly slug: string;
  readonly fallback: Branch;
};

export type ScrapeWarningListener = (warning: ScrapeWarning) => void;
