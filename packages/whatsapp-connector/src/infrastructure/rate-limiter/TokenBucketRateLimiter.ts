import { err, ok, type Result } from "@aos/common";

import { RateLimitError } from "../../domain/errors/index.js";

export interface RateLimitStatus {
  readonly remaining: number;
  readonly resetAt: Date;
}

export interface IRateLimiter {
  tryConsume(): Result<void, RateLimitError>;
  getRateLimitStatus(): RateLimitStatus;
  notifyRateLimited(retryAfterMs: number): void;
}

const DEFAULT_CAPACITY = 100;
const DEFAULT_REFILL_WINDOW_MS = 100 * 1000; // 100 tokens / 100 seconds — the spec's default (conservative under Meta's real 1,000/sec limit).

export interface TokenBucketRateLimiterOptions {
  readonly capacity?: number;
  readonly refillWindowMs?: number;
  /** Injectable clock — defaults to the real wall clock only at this outermost point, never
   * called directly by the token-accounting logic, so tests can control time deterministically. */
  readonly now?: () => number;
}

/**
 * Token bucket for a single `phone_number_id`. One instance per branch — see
 * `PhoneNumberRateLimiterRegistry` below for the per-`phoneNumberId` fan-out (4 independent
 * branches must never share one bucket). Refill is continuous/lazy (computed on read, not via a
 * background timer), mirroring `@aos/meta-ads-connector`'s `TokenBucketRateLimiter` exactly.
 */
export class TokenBucketRateLimiter implements IRateLimiter {
  private readonly capacity: number;
  private readonly refillWindowMs: number;
  private readonly now: () => number;
  private tokens: number;
  private lastRefillAt: number;
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
        new RateLimitError("Local per-phoneNumberId rate-limit budget exhausted", retryAfterMs),
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

/**
 * Fans a single `TokenBucketRateLimiterOptions` template out to one independent bucket per
 * `phone_number_id` — the spec is explicit that rate limiting is per-number, not global (4
 * branches, 4 independent buckets). Buckets are created lazily on first use.
 */
export class PhoneNumberRateLimiterRegistry {
  private readonly buckets = new Map<string, TokenBucketRateLimiter>();

  constructor(private readonly options: TokenBucketRateLimiterOptions = {}) {}

  forPhoneNumberId(phoneNumberId: string): TokenBucketRateLimiter {
    const existing = this.buckets.get(phoneNumberId);
    if (existing !== undefined) {
      return existing;
    }
    const created = new TokenBucketRateLimiter(this.options);
    this.buckets.set(phoneNumberId, created);
    return created;
  }
}
