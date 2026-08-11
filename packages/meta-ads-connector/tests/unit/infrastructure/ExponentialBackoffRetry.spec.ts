import { err, ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import {
  AuthError,
  ApiServerError,
  PermissionError,
  RateLimitError,
} from "../../../src/domain/errors/index.js";
import {
  ExponentialBackoffRetry,
  isRetryable,
} from "../../../src/infrastructure/retry/ExponentialBackoffRetry.js";

describe("isRetryable", () => {
  it("treats 429 as retryable", () => {
    expect(isRetryable(new RateLimitError("rate limited", 1000))).toBe(true);
  });

  it("treats 500 as retryable", () => {
    expect(isRetryable(new ApiServerError("server error", { httpStatus: 500 }))).toBe(true);
  });

  it("treats 503 as retryable", () => {
    expect(isRetryable(new ApiServerError("unavailable", { httpStatus: 503 }))).toBe(true);
  });

  it("treats a network failure (ApiServerError with no httpStatus) as retryable", () => {
    expect(isRetryable(new ApiServerError("network failure"))).toBe(true);
  });

  it("treats 400 as not retryable", () => {
    expect(isRetryable(new ApiServerError("bad request", { httpStatus: 400 }))).toBe(false);
  });

  it("treats 401 (AuthError) as not retryable", () => {
    expect(isRetryable(new AuthError("token expired"))).toBe(false);
  });

  it("treats 403 (PermissionError) as not retryable", () => {
    expect(isRetryable(new PermissionError("missing permission"))).toBe(false);
  });

  it("treats an unlisted status as not retryable (fail closed)", () => {
    expect(isRetryable(new ApiServerError("teapot", { httpStatus: 418 }))).toBe(false);
  });
});

describe("ExponentialBackoffRetry", () => {
  it("delayForAttempt computes 1000/2000/4000ms for attempts 1/2/3", () => {
    const retry = new ExponentialBackoffRetry();
    expect(retry.delayForAttempt(1)).toBe(1000);
    expect(retry.delayForAttempt(2)).toBe(2000);
    expect(retry.delayForAttempt(3)).toBe(4000);
  });

  it("respects a custom baseDelayMs", () => {
    const retry = new ExponentialBackoffRetry({ baseDelayMs: 500 });
    expect(retry.delayForAttempt(1)).toBe(500);
    expect(retry.delayForAttempt(2)).toBe(1000);
  });

  it("returns immediately on first-attempt success — no sleep called", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const retry = new ExponentialBackoffRetry({ sleep });
    const operation = vi.fn().mockResolvedValue(ok("done"));
    const result = await retry.execute(operation);
    expect(result).toEqual(ok("done"));
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries a retryable failure up to maxAttempts, sleeping the exact 1s/2s delays between attempts", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const retry = new ExponentialBackoffRetry({ sleep, maxAttempts: 3 });
    const operation = vi
      .fn()
      .mockResolvedValueOnce(err(new ApiServerError("fail 1", { httpStatus: 500 })))
      .mockResolvedValueOnce(err(new ApiServerError("fail 2", { httpStatus: 500 })))
      .mockResolvedValueOnce(ok("recovered"));

    const result = await retry.execute(operation);
    expect(result).toEqual(ok("recovered"));
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2000);
  });

  it("stops after maxAttempts (3) and returns the last error — never calls a 4th time", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const retry = new ExponentialBackoffRetry({ sleep, maxAttempts: 3 });
    const failure = err(new ApiServerError("always fails", { httpStatus: 500 }));
    const operation = vi.fn().mockResolvedValue(failure);

    const result = await retry.execute(operation);
    expect(result).toEqual(failure);
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a non-retryable failure (e.g. 401) — fails on the first attempt", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const retry = new ExponentialBackoffRetry({ sleep, maxAttempts: 3 });
    const operation = vi.fn().mockResolvedValue(err(new AuthError("token expired")));

    const result = await retry.execute(operation);
    expect(result.ok).toBe(false);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("defaults to maxAttempts=3, baseDelayMs=1000 when no options given", () => {
    const retry = new ExponentialBackoffRetry();
    expect(retry.delayForAttempt(1)).toBe(1000);
  });

  it("uses the real setTimeout-based sleep when no sleep is injected", async () => {
    vi.useFakeTimers();
    try {
      const retry = new ExponentialBackoffRetry({ maxAttempts: 2, baseDelayMs: 10 });
      const operation = vi
        .fn()
        .mockResolvedValueOnce(err(new ApiServerError("fail 1", { httpStatus: 500 })))
        .mockResolvedValueOnce(ok("recovered"));

      const executePromise = retry.execute(operation);
      // Let the microtask queue drain so `operation()` (attempt 1) resolves and `realSleep`'s
      // `setTimeout(resolve, 10)` is actually scheduled before we advance fake time past it.
      await vi.advanceTimersByTimeAsync(10);
      const result = await executePromise;

      expect(result).toEqual(ok("recovered"));
      expect(operation).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns the (undefined) lastResult when constructed with maxAttempts=0 (loop never runs)", async () => {
    // Documented as "unreachable when maxAttempts >= 1" — `ExponentialBackoffRetryOptions` doesn't
    // itself enforce positivity (the real composition root's config schema does, via
    // `retryMaxAttempts: z.number().int().positive()`), so a directly-constructed retry with a
    // non-positive maxAttempts skips the loop body entirely and falls through to the final return.
    const sleep = vi.fn().mockResolvedValue(undefined);
    const retry = new ExponentialBackoffRetry({ sleep, maxAttempts: 0 });
    const operation = vi.fn().mockResolvedValue(ok("never reached"));

    const result = await retry.execute(operation);

    expect(result).toBeUndefined();
    expect(operation).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
  });
});
