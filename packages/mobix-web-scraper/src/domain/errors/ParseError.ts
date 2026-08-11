import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { ScraperError } from "./ScraperError.js";

/**
 * The fetched HTML could not be parsed into the expected shape (missing markup, unrecognized
 * price/kilometer text format, empty listing). Always `ErrorCode.VALIDATION_ERROR` — the raw
 * HTML text is the "input" this package's regex-based parsers validate against.
 */
export class ParseError extends ScraperError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.VALIDATION_ERROR, message, options);
  }
}
