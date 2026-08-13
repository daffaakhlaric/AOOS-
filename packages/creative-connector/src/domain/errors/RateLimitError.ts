import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { CreativeConnectorError } from "./CreativeConnectorError.js";

/**
 * HTTP 429 from either `api.kie.ai` host — Kie AI's documented limit is 20 requests / 10 seconds.
 * Carries `retryAfterMs` (mirrors `@aos/meta-ads-connector`'s `RateLimitError` shape) so callers
 * (the token-bucket rate limiter's own retry loop) know how long to back off.
 */
export class RateLimitError extends CreativeConnectorError {
  public readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number, options: AosErrorOptions = {}) {
    super(ErrorCode.RATE_LIMITED, message, options);
    this.retryAfterMs = retryAfterMs;
  }
}
