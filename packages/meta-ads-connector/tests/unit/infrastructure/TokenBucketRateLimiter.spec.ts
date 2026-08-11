import { describe, expect, it } from "vitest";

import { TokenBucketRateLimiter } from "../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { TestClock } from "../../helpers/clock.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("TokenBucketRateLimiter", () => {
  it("starts full at capacity", () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const limiter = new TokenBucketRateLimiter({ capacity: 200, now: clock.now });
    expect(limiter.getRateLimitStatus().remaining).toBe(200);
  });

  it("consumes one token per tryConsume() call", () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const limiter = new TokenBucketRateLimiter({ capacity: 200, now: clock.now });
    unwrap(limiter.tryConsume());
    expect(limiter.getRateLimitStatus().remaining).toBe(199);
  });

  it("exhausts after `capacity` consumptions and rejects the next call", () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const limiter = new TokenBucketRateLimiter({ capacity: 3, now: clock.now });
    unwrap(limiter.tryConsume());
    unwrap(limiter.tryConsume());
    unwrap(limiter.tryConsume());
    const result = limiter.tryConsume();
    expect(result.ok).toBe(false);
    expect(unwrapErr(result).message).toMatch(/exhausted/);
  });

  it("refills over simulated elapsed time via the injected clock", () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const limiter = new TokenBucketRateLimiter({
      capacity: 200,
      refillWindowMs: 60 * 60 * 1000,
      now: clock.now,
    });
    for (let i = 0; i < 200; i += 1) {
      unwrap(limiter.tryConsume());
    }
    expect(limiter.tryConsume().ok).toBe(false);

    // Advance 18 minutes = 1/(10/3) of an hour ≈ 60 tokens refilled (200 * 18/60 = 60).
    clock.advanceMs(18 * 60 * 1000);
    const status = limiter.getRateLimitStatus();
    expect(status.remaining).toBeGreaterThanOrEqual(59);
    expect(status.remaining).toBeLessThanOrEqual(61);
    expect(limiter.tryConsume().ok).toBe(true);
  });

  it("never refills above capacity even with a huge elapsed time", () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const limiter = new TokenBucketRateLimiter({ capacity: 200, now: clock.now });
    clock.advanceMs(1000 * 60 * 60 * 1000);
    expect(limiter.getRateLimitStatus().remaining).toBe(200);
  });

  it("getRateLimitStatus reports resetAt = now when the bucket is full", () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const limiter = new TokenBucketRateLimiter({ capacity: 200, now: clock.now });
    const status = limiter.getRateLimitStatus();
    expect(status.resetAt.getTime()).toBe(clock.now());
  });

  it("getRateLimitStatus reports a future resetAt once exhausted", () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const limiter = new TokenBucketRateLimiter({ capacity: 2, now: clock.now });
    unwrap(limiter.tryConsume());
    unwrap(limiter.tryConsume());
    const status = limiter.getRateLimitStatus();
    expect(status.resetAt.getTime()).toBeGreaterThan(clock.now());
  });

  it("notifyRateLimited zeroes the bucket and floors resetAt at now + retryAfterMs", () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const limiter = new TokenBucketRateLimiter({ capacity: 200, now: clock.now });
    limiter.notifyRateLimited(30_000);
    expect(limiter.getRateLimitStatus().remaining).toBe(0);
    expect(limiter.getRateLimitStatus().resetAt.getTime()).toBe(clock.now() + 30_000);
  });

  it("notifyRateLimited's external reset floor wins over a sooner local reset estimate", () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const limiter = new TokenBucketRateLimiter({ capacity: 200, now: clock.now });
    limiter.notifyRateLimited(120_000);
    clock.advanceMs(1000); // one local token would already be available again, but Meta said wait longer
    expect(limiter.getRateLimitStatus().resetAt.getTime()).toBeGreaterThanOrEqual(
      clock.now() + 100_000,
    );
  });

  it("defaults to capacity 200 and a 1-hour refill window when no options are given", () => {
    const limiter = new TokenBucketRateLimiter();
    expect(limiter.getRateLimitStatus().remaining).toBe(200);
  });

  it("uses the real Date.now by default when no clock is injected", () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 5 });
    expect(limiter.tryConsume().ok).toBe(true);
  });
});
