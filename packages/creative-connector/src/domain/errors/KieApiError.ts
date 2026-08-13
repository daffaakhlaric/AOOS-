import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { CreativeConnectorError } from "./CreativeConnectorError.js";

export interface KieApiErrorOptions extends AosErrorOptions {
  /** HTTP status returned by `api.kie.ai`, when the failure is HTTP-shaped (e.g. 401, 500). Absent for network-level failures. */
  readonly httpStatus?: number;
}

/**
 * A `api.kie.ai` call failed — a non-2xx HTTP response (other than 429, which is `RateLimitError`)
 * or a transport/network failure reaching it. Always `ErrorCode.UNAVAILABLE`: the fault is on Kie
 * AI's side (or the network path to it), never a bad input to this package's own logic — mirrors
 * `@aos/mobix-web-scraper`'s `ScrapeError` reasoning for the same code choice.
 */
export class KieApiError extends CreativeConnectorError {
  public readonly httpStatus: number | undefined;

  constructor(message: string, options: KieApiErrorOptions = {}) {
    super(ErrorCode.UNAVAILABLE, message, options);
    this.httpStatus = options.httpStatus;
  }
}
