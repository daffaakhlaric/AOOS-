import type { Result } from "@aos/common";

import type { RateLimitError } from "../domain/errors/index.js";

export interface RateLimitStatus {
  readonly remaining: number;
  readonly resetAt: Date;
}

/**
 * Port (Strategy Pattern) for enforcing Meta's 200-calls/hour/ad-account limit. The only
 * implementation is `infrastructure/rate-limiter/TokenBucketRateLimiter.ts`.
 */
export interface IRateLimiter {
  /** Attempts to consume one token; `Result.err(RateLimitError)` when the bucket is empty. */
  tryConsume(): Result<void, RateLimitError>;
  getRateLimitStatus(): RateLimitStatus;
  /** Called after receiving an HTTP 429 from Meta itself, to align local accounting with Meta's own `Retry-After`. */
  notifyRateLimited(retryAfterMs: number): void;
  /**
   * Real, currently-broken-in-production "User request limit reached" fix — proactive throttling.
   * Called with the worst-case usage percentage (0-100) parsed from Meta's real, documented
   * `X-Business-Use-Case-Usage` response header (see `infrastructure/meta-api/UsageHeaderParser.ts`)
   * on EVERY Meta response (success or failure), not just after a hard 429/503. Lets the rate
   * limiter degrade callers to a clear "sedang dibatasi Meta, coba lagi dalam N menit" cooldown
   * BEFORE the hard wall is actually hit, instead of only reacting after Meta has already refused
   * a call. A no-op for usage comfortably below the real limit — this must never make the local
   * budget MORE restrictive than Meta's real, documented threshold warrants.
   */
  applyUsage(usagePercent: number, estimatedTimeToRegainAccessMinutes: number): void;
}
