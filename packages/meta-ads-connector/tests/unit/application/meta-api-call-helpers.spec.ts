import { err, ok, type Result } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import {
  callMetaApi,
  extractOrFetch,
  fetchAllPages,
} from "../../../src/application/use-cases/meta-api-call-helpers.js";
import { ApiServerError, RateLimitError } from "../../../src/domain/errors/index.js";
import { TokenBucketRateLimiter } from "../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { TestClock } from "../../helpers/clock.js";

describe("callMetaApi", () => {
  it("fails fast without calling the operation when the local rate-limit budget is exhausted", async () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const rateLimiter = new TokenBucketRateLimiter({ capacity: 0, now: clock.now });
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
    const operation = vi.fn().mockResolvedValue(ok("never"));

    const result = await callMetaApi(rateLimiter, retry, operation);
    expect(result.ok).toBe(false);
    expect(operation).not.toHaveBeenCalled();
  });

  it("calls the operation and returns its success", async () => {
    const rateLimiter = new TokenBucketRateLimiter();
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
    const result = await callMetaApi(rateLimiter, retry, async () => ok("value"));
    expect(result).toEqual(ok("value"));
  });

  it("feeds a 429's retryAfterMs back into the rate limiter via notifyRateLimited", async () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const rateLimiter = new TokenBucketRateLimiter({ capacity: 5, now: clock.now });
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined, maxAttempts: 1 });
    await callMetaApi(rateLimiter, retry, async () =>
      err(new RateLimitError("rate limited", 45_000)),
    );
    const status = rateLimiter.getRateLimitStatus();
    expect(status.remaining).toBe(0);
    // resetAt is floored at now + retryAfterMs, but may be later still if the local token-refill
    // estimate (based on this tiny 5-token capacity) takes even longer than Meta's 45s Retry-After.
    expect(status.resetAt.getTime()).toBeGreaterThanOrEqual(clock.now() + 45_000);
  });

  it("does not call notifyRateLimited for a non-RateLimitError failure", async () => {
    const clock = new TestClock("2026-01-01T00:00:00.000Z");
    const rateLimiter = new TokenBucketRateLimiter({ capacity: 5, now: clock.now });
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined, maxAttempts: 1 });
    await callMetaApi(rateLimiter, retry, async () =>
      err(new ApiServerError("server error", { httpStatus: 400 })),
    );
    expect(rateLimiter.getRateLimitStatus().remaining).toBe(4);
  });
});

describe("fetchAllPages", () => {
  it("accumulates a single page with no paging info", async () => {
    const fetchPage = vi.fn().mockResolvedValue(ok({ data: [1, 2, 3] }));
    const result = await fetchAllPages(fetchPage);
    expect(result).toEqual(ok([1, 2, 3]));
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("follows paging.next/paging.cursors.after across multiple pages", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(
        ok({ data: [1, 2], paging: { cursors: { after: "cursor-1" }, next: "https://x/next" } }),
      )
      .mockResolvedValueOnce(ok({ data: [3, 4] }));
    const result = await fetchAllPages(fetchPage);
    expect(result).toEqual(ok([1, 2, 3, 4]));
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(2, { after: "cursor-1" });
  });

  it("stops pagination when `next` is present but cursors.after is missing", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValue(ok({ data: [1], paging: { next: "https://x/next" } }));
    const result = await fetchAllPages(fetchPage);
    expect(result).toEqual(ok([1]));
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("propagates a page-fetch failure", async () => {
    const failure: Result<{ data: number[] }, ApiServerError> = err(new ApiServerError("boom"));
    const fetchPage = vi.fn().mockResolvedValue(failure);
    const result = await fetchAllPages(fetchPage);
    expect(result.ok).toBe(false);
  });

  it("returns an empty array for an empty first page", async () => {
    const result = await fetchAllPages(async () => ok({ data: [] }));
    expect(result).toEqual(ok([]));
  });
});

/**
 * N+1-fanout fix — `extractOrFetch` is the shared decision point `PullCampaignData` uses to
 * decide, per campaign/adset, whether a nested field-expansion edge is genuinely complete (use it
 * directly, zero extra calls) or must fall back to the pre-existing dedicated paginated edge call
 * (an overflow, or the edge being absent entirely).
 */
describe("extractOrFetch", () => {
  it("uses the nested page directly (no fetchFn call) when it has no paging.next", async () => {
    const fetchFn = vi.fn();
    const result = await extractOrFetch({ data: [1, 2, 3] }, fetchFn);
    expect(result).toEqual(ok([1, 2, 3]));
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("falls back to fetchFn when the nested edge is undefined (absent from the response)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok([9, 8, 7]));
    const result = await extractOrFetch<number>(undefined, fetchFn);
    expect(result).toEqual(ok([9, 8, 7]));
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("falls back to fetchFn when the nested edge overflowed its own page (paging.next present)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok([1, 2, 3, 4, 5]));
    const result = await extractOrFetch(
      { data: [1, 2], paging: { next: "https://graph.facebook.com/v21.0/x?after=y" } },
      fetchFn,
    );
    expect(result).toEqual(ok([1, 2, 3, 4, 5]));
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("does not fall back when paging is present but has no `next` (e.g. a lone cursors object)", async () => {
    const fetchFn = vi.fn();
    const result = await extractOrFetch({ data: [1], paging: { cursors: {} } }, fetchFn);
    expect(result).toEqual(ok([1]));
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("propagates a fetchFn failure", async () => {
    const fetchFn = vi.fn().mockResolvedValue(err(new ApiServerError("boom")));
    const result = await extractOrFetch<number>(undefined, fetchFn);
    expect(result.ok).toBe(false);
  });
});
