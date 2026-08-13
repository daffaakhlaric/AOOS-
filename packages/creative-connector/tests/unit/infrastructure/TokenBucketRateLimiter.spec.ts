import { describe, expect, it, vi } from "vitest";

import { TokenBucketRateLimiter } from "../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { unwrapErr } from "../../helpers/result.js";

describe("TokenBucketRateLimiter", () => {
  it("allows consuming up to capacity (20) tokens", () => {
    const limiter = new TokenBucketRateLimiter({ now: () => 0 });
    for (let i = 0; i < 20; i += 1) {
      expect(limiter.tryConsume().ok).toBe(true);
    }
  });

  it("rejects the 21st consume within the same window", () => {
    const limiter = new TokenBucketRateLimiter({ now: () => 0 });
    for (let i = 0; i < 20; i += 1) {
      limiter.tryConsume();
    }
    const error = unwrapErr(limiter.tryConsume());
    expect(error.message).toMatch(/20 requests \/ 10 seconds/);
    expect(error.retryAfterMs).toBeGreaterThan(0);
  });

  it("refills over time (10s window)", () => {
    let now = 0;
    const limiter = new TokenBucketRateLimiter({ now: () => now });
    for (let i = 0; i < 20; i += 1) {
      limiter.tryConsume();
    }
    expect(limiter.tryConsume().ok).toBe(false);
    now += 10_000; // full window elapsed
    expect(limiter.tryConsume().ok).toBe(true);
  });

  it("does not exceed capacity when a lot of time elapses", () => {
    let now = 0;
    const limiter = new TokenBucketRateLimiter({ now: () => now, capacity: 20 });
    now += 1_000_000;
    const status = limiter.getRateLimitStatus();
    expect(status.remaining).toBe(20);
  });

  it("calls onLowTokens when fewer than 5 tokens remain", () => {
    const onLowTokens = vi.fn();
    const limiter = new TokenBucketRateLimiter({ now: () => 0, onLowTokens });
    for (let i = 0; i < 16; i += 1) {
      limiter.tryConsume();
    }
    expect(onLowTokens).toHaveBeenCalled();
  });

  it("does not call onLowTokens while 5+ tokens remain", () => {
    const onLowTokens = vi.fn();
    const limiter = new TokenBucketRateLimiter({ now: () => 0, onLowTokens });
    limiter.tryConsume();
    expect(onLowTokens).not.toHaveBeenCalled();
  });

  it("getRateLimitStatus reports a resetAt in the future when tokens are exhausted", () => {
    const limiter = new TokenBucketRateLimiter({ now: () => 0 });
    for (let i = 0; i < 20; i += 1) {
      limiter.tryConsume();
    }
    const status = limiter.getRateLimitStatus();
    expect(status.remaining).toBe(0);
    expect(status.resetAt.getTime()).toBeGreaterThan(0);
  });

  it("defaults `now` to the real wall clock when not injected", () => {
    const limiter = new TokenBucketRateLimiter();
    expect(limiter.tryConsume().ok).toBe(true);
  });
});
