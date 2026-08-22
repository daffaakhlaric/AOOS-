import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { MetaGraphApiError } from "./MetaGraphApiError.js";

/** HTTP 429 — either our own TokenBucketRateLimiter's local budget or Meta's own rate limit. */
export class RateLimitError extends MetaGraphApiError {
  public readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number, options: AosErrorOptions = {}) {
    super(message, { ...options, httpStatus: 429 }, ErrorCode.RATE_LIMITED);
    this.retryAfterMs = retryAfterMs;
  }
}
