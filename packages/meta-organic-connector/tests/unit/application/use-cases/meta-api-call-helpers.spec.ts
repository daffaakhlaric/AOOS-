import { err, ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import { callMetaOrganicApi } from "../../../../src/application/use-cases/meta-api-call-helpers.js";
import { ApiServerError, RateLimitError } from "../../../../src/domain/errors/index.js";
import { TokenBucketRateLimiter } from "../../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { TestClock } from "../../../helpers/clock.js";

describe("callMetaOrganicApi", () => {
  it("fails fast without calling the operation when the local rate-limit budget is exhausted", async () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const rateLimiter = new TokenBucketRateLimiter({ capacity: 0, now: clock.now });
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
    const operation = vi.fn().mockResolvedValue(ok("never"));

    const result = await callMetaOrganicApi(rateLimiter, retry, operation);
    expect(result.ok).toBe(false);
    expect(operation).not.toHaveBeenCalled();
  });

  it("calls the operation and returns its success", async () => {
    const rateLimiter = new TokenBucketRateLimiter();
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
    const result = await callMetaOrganicApi(rateLimiter, retry, async () => ok("value"));
    expect(result).toEqual(ok("value"));
  });

  it("feeds a 429's retryAfterMs back into the rate limiter via notifyRateLimited", async () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const rateLimiter = new TokenBucketRateLimiter({ capacity: 5, now: clock.now });
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined, maxAttempts: 1 });
    await callMetaOrganicApi(rateLimiter, retry, async () =>
      err(new RateLimitError("rate limited", 45_000)),
    );
    const status = rateLimiter.getRateLimitStatus();
    expect(status.remaining).toBe(0);
    expect(status.resetAt.getTime()).toBeGreaterThanOrEqual(clock.now() + 45_000);
  });

  it("does not call notifyRateLimited for a non-RateLimitError failure", async () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const rateLimiter = new TokenBucketRateLimiter({ capacity: 5, now: clock.now });
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined, maxAttempts: 1 });
    await callMetaOrganicApi(rateLimiter, retry, async () =>
      err(new ApiServerError("server error", { httpStatus: 400 })),
    );
    expect(rateLimiter.getRateLimitStatus().remaining).toBe(4);
  });
});
