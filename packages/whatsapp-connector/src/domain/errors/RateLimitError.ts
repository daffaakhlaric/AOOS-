import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { WhatsAppApiError } from "./WhatsAppApiError.js";

/** HTTP 429 — either our own `TokenBucketRateLimiter`'s local per-`phoneNumberId` budget, or WhatsApp Cloud API's own rate limit. */
export class RateLimitError extends WhatsAppApiError {
  public readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number, options: AosErrorOptions = {}) {
    super(message, { ...options, httpStatus: 429 }, ErrorCode.RATE_LIMITED);
    this.retryAfterMs = retryAfterMs;
  }
}
