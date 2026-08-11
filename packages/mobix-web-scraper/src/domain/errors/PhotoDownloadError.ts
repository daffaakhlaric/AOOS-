import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { ScraperError } from "./ScraperError.js";

/**
 * A single unit photo could not be downloaded from mobixbydss.id (network error, CORS/403,
 * non-2xx status, timeout) or could not be uploaded to `@aos/asset-library`. Always
 * `ErrorCode.UNAVAILABLE`, mirroring `ScrapeError` — the remote site/storage is the fault, never
 * a bad input to this package's own logic. `DownloadAndStorePhotos` never lets this escape as a
 * thrown exception or a whole-batch `Result.err`: it is collected per-photo into
 * `PhotoBatchResult.failed`, so one bad photo never fails the rest of a unit's photo batch.
 */
export class PhotoDownloadError extends ScraperError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.UNAVAILABLE, message, options);
  }
}
