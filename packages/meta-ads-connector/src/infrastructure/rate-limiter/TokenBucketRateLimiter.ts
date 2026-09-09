import { err, ok, type Result } from "@aos/common";

import type { IRateLimiter, RateLimitStatus } from "../../contracts/IRateLimiter.js";
import { RateLimitError } from "../../domain/errors/index.js";

const DEFAULT_CAPACITY = 200;
const DEFAULT_REFILL_WINDOW_MS = 60 * 60 * 1000; // 1 hour — 200 tokens/hour ≈ 0.0556 tokens/sec

/**
 * Real, currently-broken-in-production "User request limit reached" fix — the
 * `X-Business-Use-Case-Usage` percentage (see `infrastructure/meta-api/UsageHeaderParser.ts`) at
 * or above which `applyUsage` proactively zeroes the local bucket and imposes a cooldown, BEFORE
 * Meta's own hard 503 wall is hit. 90% is a deliberately conservative threshold — real Meta
 * traffic in a short burst (e.g. this incident's N+1 fanout, or three call sites' pulls landing
 * within the same window) can jump several percentage points between one response and the next,
 * so backing off at 90% (not 99-100%) leaves real headroom to actually avoid the wall rather than
 * reacting exactly as the wall is hit.
 */
const PROACTIVE_THROTTLE_THRESHOLD_PERCENT = 90;
/** Real fallback cooldown when Meta's usage header reports ≥90% usage but no real `estimated_time_to_regain_access` yet (that field is only ever nonzero once usage has actually reached 100%) — conservative enough to genuinely back off, short enough not to block legitimate use for long. */
const DEFAULT_PROACTIVE_COOLDOWN_MS = 5 * 60 * 1000;

export interface TokenBucketRateLimiterOptions {
  readonly capacity?: number;
  readonly refillWindowMs?: number;
  /** Injectable clock — defaults to real `Date.now` only at this outermost composition point,
   * never called directly by the token-accounting logic below, so tests can control time
   * precisely and deterministically (per the task's explicit rate-limiter determinism requirement). */
  readonly now?: () => number;
}

/**
 * Token bucket implementing Meta's 200-calls/hour/ad-account limit (spec: "Rate Limiting").
 * Refill is continuous/lazy (computed on read, not via a background timer) — every public method
 * first "tops up" the bucket based on elapsed time since the last refill, then acts. This keeps
 * the whole class synchronous and trivially testable via an injected clock, with no real timers.
 */
export class TokenBucketRateLimiter implements IRateLimiter {
  private readonly capacity: number;
  private readonly refillWindowMs: number;
  private readonly now: () => number;
  private tokens: number;
  private lastRefillAt: number;
  /** Set by `notifyRateLimited` when Meta itself returns a 429 — floors `resetAt` until this timestamp even if local accounting would otherwise report tokens sooner. */
  private externalResetAt: number | undefined;

  constructor(options: TokenBucketRateLimiterOptions = {}) {
    this.capacity = options.capacity ?? DEFAULT_CAPACITY;
    this.refillWindowMs = options.refillWindowMs ?? DEFAULT_REFILL_WINDOW_MS;
    this.now = options.now ?? Date.now;
    this.tokens = this.capacity;
    this.lastRefillAt = this.now();
  }

  private refill(): void {
    const nowMs = this.now();
    const elapsedMs = nowMs - this.lastRefillAt;
    if (elapsedMs <= 0) {
      return;
    }
    const refillRatePerMs = this.capacity / this.refillWindowMs;
    const replenished = elapsedMs * refillRatePerMs;
    if (replenished > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + replenished);
      this.lastRefillAt = nowMs;
    }
  }

  tryConsume(): Result<void, RateLimitError> {
    this.refill();
    if (this.tokens < 1) {
      const retryAfterMs = this.msUntilNextToken();
      return err(
        new RateLimitError("Local rate-limit budget exhausted (200 calls/hour)", retryAfterMs),
      );
    }
    this.tokens -= 1;
    return ok(undefined);
  }

  private msUntilNextToken(): number {
    const refillRatePerMs = this.capacity / this.refillWindowMs;
    const deficitTokens = 1 - this.tokens;
    return Math.max(0, Math.ceil(deficitTokens / refillRatePerMs));
  }

  getRateLimitStatus(): RateLimitStatus {
    this.refill();
    const nowMs = this.now();
    const localResetMs = nowMs + this.msUntilNextToken();
    const resetAtMs =
      this.externalResetAt !== undefined
        ? Math.max(this.externalResetAt, localResetMs)
        : localResetMs;
    return {
      remaining: Math.floor(this.tokens),
      resetAt: new Date(this.tokens >= this.capacity ? nowMs : resetAtMs),
    };
  }

  notifyRateLimited(retryAfterMs: number): void {
    this.refill();
    this.tokens = 0;
    this.externalResetAt = this.now() + Math.max(0, retryAfterMs);
  }

  /** See `IRateLimiter.applyUsage`'s docstring for the real, documented signal this reacts to. */
  applyUsage(usagePercent: number, estimatedTimeToRegainAccessMinutes: number): void {
    if (usagePercent < PROACTIVE_THROTTLE_THRESHOLD_PERCENT) {
      return;
    }
    this.refill();
    this.tokens = 0;
    const cooldownMs =
      estimatedTimeToRegainAccessMinutes > 0
        ? estimatedTimeToRegainAccessMinutes * 60_000
        : DEFAULT_PROACTIVE_COOLDOWN_MS;
    const candidateResetAt = this.now() + cooldownMs;
    this.externalResetAt =
      this.externalResetAt !== undefined
        ? Math.max(this.externalResetAt, candidateResetAt)
        : candidateResetAt;
  }
}
