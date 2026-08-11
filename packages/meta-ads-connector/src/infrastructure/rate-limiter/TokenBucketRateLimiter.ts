import { err, ok, type Result } from "@aos/common";

import type { IRateLimiter, RateLimitStatus } from "../../contracts/IRateLimiter.js";
import { RateLimitError } from "../../domain/errors/index.js";

const DEFAULT_CAPACITY = 200;
const DEFAULT_REFILL_WINDOW_MS = 60 * 60 * 1000; // 1 hour — 200 tokens/hour ≈ 0.0556 tokens/sec

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
}
