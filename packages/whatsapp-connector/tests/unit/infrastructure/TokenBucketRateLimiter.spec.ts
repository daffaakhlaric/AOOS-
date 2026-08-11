import { describe, expect, it } from "vitest";

import { RateLimitError } from "../../../src/domain/errors/index.js";
import {
  PhoneNumberRateLimiterRegistry,
  TokenBucketRateLimiter,
} from "../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { TestClock } from "../../helpers/clock.js";

describe("TokenBucketRateLimiter", () => {
  it("starts full and allows consuming up to capacity", () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 3, refillWindowMs: 1000 });
    expect(limiter.tryConsume().ok).toBe(true);
    expect(limiter.tryConsume().ok).toBe(true);
    expect(limiter.tryConsume().ok).toBe(true);
    const fourth = limiter.tryConsume();
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) {
      expect(fourth.error).toBeInstanceOf(RateLimitError);
    }
  });

  it("refills tokens over time using an injected clock", () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const limiter = new TokenBucketRateLimiter({
      capacity: 2,
      refillWindowMs: 1000,
      now: clock.now,
    });
    limiter.tryConsume();
    limiter.tryConsume();
    expect(limiter.tryConsume().ok).toBe(false);

    clock.advanceMs(1000);
    expect(limiter.tryConsume().ok).toBe(true);
  });

  it("getRateLimitStatus reports remaining tokens and resetAt", () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const limiter = new TokenBucketRateLimiter({
      capacity: 2,
      refillWindowMs: 1000,
      now: clock.now,
    });
    const full = limiter.getRateLimitStatus();
    expect(full.remaining).toBe(2);

    limiter.tryConsume();
    const status = limiter.getRateLimitStatus();
    expect(status.remaining).toBe(1);
  });

  it("notifyRateLimited zeroes the bucket and floors resetAt at retryAfterMs", () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const limiter = new TokenBucketRateLimiter({
      capacity: 2,
      refillWindowMs: 1000,
      now: clock.now,
    });
    limiter.notifyRateLimited(5000);
    const status = limiter.getRateLimitStatus();
    expect(status.remaining).toBe(0);
    expect(status.resetAt.getTime()).toBe(clock.now() + 5000);
  });

  it("notifyRateLimited clamps a negative retryAfterMs to 0 (external reset never precedes now)", () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const limiter = new TokenBucketRateLimiter({
      capacity: 2,
      refillWindowMs: 1000,
      now: clock.now,
    });
    limiter.notifyRateLimited(-100);
    const status = limiter.getRateLimitStatus();
    // externalResetAt floors at now (clamped), but the local refill-based reset estimate for an
    // empty 2-token/1000ms bucket (500ms to the next token) is later — resetAt is the max of the two.
    expect(status.resetAt.getTime()).toBe(clock.now() + 500);
  });

  it("defaults capacity/refillWindowMs/now when not provided", () => {
    const limiter = new TokenBucketRateLimiter();
    expect(limiter.tryConsume().ok).toBe(true);
  });

  it("does not refill when elapsed time is zero or negative", () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const limiter = new TokenBucketRateLimiter({ capacity: 1, now: clock.now });
    limiter.tryConsume();
    // Same instant — no refill should happen.
    expect(limiter.tryConsume().ok).toBe(false);
  });
});

describe("PhoneNumberRateLimiterRegistry", () => {
  it("gives each phoneNumberId its own independent bucket (4 branches, 4 buckets)", () => {
    const registry = new PhoneNumberRateLimiterRegistry({ capacity: 1, refillWindowMs: 1000 });
    const bintaro = registry.forPhoneNumberId("bintaro-id");
    const cinere = registry.forPhoneNumberId("cinere-id");

    expect(bintaro.tryConsume().ok).toBe(true);
    // Bintaro's bucket is now empty, but Cinere's is untouched.
    expect(bintaro.tryConsume().ok).toBe(false);
    expect(cinere.tryConsume().ok).toBe(true);
  });

  it("returns the same bucket instance for repeated lookups of the same phoneNumberId", () => {
    const registry = new PhoneNumberRateLimiterRegistry();
    const a = registry.forPhoneNumberId("id-1");
    const b = registry.forPhoneNumberId("id-1");
    expect(a).toBe(b);
  });
});
