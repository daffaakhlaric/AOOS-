import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { ScraperError } from "./ScraperError.js";

/**
 * The HTTP fetch against mobixbydss.id failed (network error, non-2xx status, timeout) —
 * always `ErrorCode.UNAVAILABLE`, since the concrete cause is a remote-site fault, never a
 * bad input to this package's own logic.
 */
export class ScrapeError extends ScraperError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.UNAVAILABLE, message, options);
  }
}
