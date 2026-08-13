import { err, ok, type Result } from "@aos/common";

import { RateLimitError } from "../../domain/errors/RateLimitError.js";

export interface RateLimitStatus {
  readonly remaining: number;
  readonly resetAt: Date;
}

export const DEFAULT_CAPACITY = 20;
export const DEFAULT_REFILL_WINDOW_MS = 10_000;
/** Per the spec's "Log warning when < 5 tokens remaining". */
export const LOW_TOKEN_WARNING_THRESHOLD = 5;

export interface TokenBucketRateLimiterOptions {
  readonly capacity?: number;
  readonly refillWindowMs?: number;
  /** Injectable clock — defaults to real `Date.now`, overridable for deterministic tests. */
  readonly now?: () => number;
  /** Invoked whenever a `tryConsume()` leaves fewer than `LOW_TOKEN_WARNING_THRESHOLD` tokens remaining. Defaults to a no-op; the factory wires this to `@aos/logger` in real use. */
  readonly onLowTokens?: (status: RateLimitStatus) => void;
}

/**
 * Token bucket implementing Kie AI's documented 20-requests/10-seconds limit. Refill is
 * continuous/lazy (computed on read, not via a background timer) — mirrors
 * `@aos/meta-ads-connector`'s `TokenBucketRateLimiter` design exactly, just re-parameterized for
 * Kie AI's window.
 */
export class TokenBucketRateLimiter {
  private readonly capacity: number;
  private readonly refillWindowMs: number;
  private readonly now: () => number;
  private readonly onLowTokens: (status: RateLimitStatus) => void;
  private tokens: number;
  private lastRefillAt: number;

  constructor(options: TokenBucketRateLimiterOptions = {}) {
    this.capacity = options.capacity ?? DEFAULT_CAPACITY;
    this.refillWindowMs = options.refillWindowMs ?? DEFAULT_REFILL_WINDOW_MS;
    this.now = options.now ?? Date.now;
    this.onLowTokens = options.onLowTokens ?? ((): void => undefined);
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
        new RateLimitError(
          "Local rate-limit budget exhausted (20 requests / 10 seconds)",
          retryAfterMs,
        ),
      );
    }
    this.tokens -= 1;
    if (this.tokens < LOW_TOKEN_WARNING_THRESHOLD) {
      this.onLowTokens(this.getRateLimitStatus());
    }
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
    const resetAtMs = this.tokens >= this.capacity ? nowMs : nowMs + this.msUntilNextToken();
    return {
      remaining: Math.floor(this.tokens),
      resetAt: new Date(resetAtMs),
    };
  }
}
