import type { Result } from "@aos/common";

import type { RateLimitError } from "../domain/errors/index.js";

export interface RateLimitStatus {
  readonly remaining: number;
  readonly resetAt: Date;
}

/**
 * Port (Strategy Pattern) for enforcing a local calls/hour budget against Meta's Graph API,
 * mirroring `@aos/meta-ads-connector`'s `IRateLimiter` shape exactly (separate interface, not a
 * shared import — coordinator note point 1: this is a genuinely separate composition root). The
 * only implementation is `infrastructure/rate-limiter/TokenBucketRateLimiter.ts`.
 */
export interface IRateLimiter {
  /** Attempts to consume one token; `Result.err(RateLimitError)` when the bucket is empty. */
  tryConsume(): Result<void, RateLimitError>;
  getRateLimitStatus(): RateLimitStatus;
  /** Called after receiving an HTTP 429 from Meta itself, to align local accounting with Meta's own `Retry-After`. */
  notifyRateLimited(retryAfterMs: number): void;
}
