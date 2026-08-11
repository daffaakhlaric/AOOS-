import { ok, err } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import {
  ApiServerError,
  AuthError,
  RateLimitError,
  WhatsAppApiError,
} from "../../../src/domain/errors/index.js";
import {
  ExponentialBackoffRetry,
  isRetryable,
} from "../../../src/infrastructure/retry/ExponentialBackoffRetry.js";

describe("isRetryable", () => {
  it("treats 429/500/503 as retryable", () => {
    expect(isRetryable(new RateLimitError("x", 1000))).toBe(true);
    expect(isRetryable(new ApiServerError("x", { httpStatus: 500 }))).toBe(true);
    expect(isRetryable(new ApiServerError("x", { httpStatus: 503 }))).toBe(true);
  });

  it("treats 400/401/403 as not retryable", () => {
    expect(isRetryable(new AuthError("x"))).toBe(false);
  });

  it("treats a network error (no httpStatus) as retryable when it's an ApiServerError", () => {
    expect(isRetryable(new ApiServerError("network down"))).toBe(true);
  });

  it("treats a non-ApiServerError with no httpStatus as not retryable", () => {
    expect(isRetryable(new WhatsAppApiError("unknown failure"))).toBe(false);
  });

  it("defaults an unlisted httpStatus to not-retryable (fail closed)", () => {
    expect(isRetryable(new ApiServerError("teapot", { httpStatus: 418 }))).toBe(false);
  });
});

describe("ExponentialBackoffRetry.execute", () => {
  it("returns immediately on first-attempt success", async () => {
    const retry = new ExponentialBackoffRetry({ sleep: vi.fn(async () => undefined) });
    const operation = vi.fn(async () => ok("done"));
    const result = await retry.execute(operation);
    expect(result).toEqual(ok("done"));
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 then succeeds", async () => {
    const sleep = vi.fn(async () => undefined);
    const retry = new ExponentialBackoffRetry({ sleep, maxAttempts: 3 });
    let calls = 0;
    const operation = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return err(new RateLimitError("rate limited", 1000));
      }
      return ok("recovered");
    });
    const result = await retry.execute(operation);
    expect(result).toEqual(ok("recovered"));
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("exhausts retries after 3 consecutive 429s and returns the last error", async () => {
    const sleep = vi.fn(async () => undefined);
    const retry = new ExponentialBackoffRetry({ sleep, maxAttempts: 3, baseDelayMs: 1000 });
    const operation = vi.fn(async () => err(new RateLimitError("rate limited", 1000)));
    const result = await retry.execute(operation);
    expect(result.ok).toBe(false);
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2000);
  });

  it("does not retry a 401 (AuthError)", async () => {
    const sleep = vi.fn(async () => undefined);
    const retry = new ExponentialBackoffRetry({ sleep, maxAttempts: 3 });
    const operation = vi.fn(async () => err(new AuthError("bad token")));
    const result = await retry.execute(operation);
    expect(result.ok).toBe(false);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("delayForAttempt computes 1s/2s/4s exponential backoff", () => {
    const retry = new ExponentialBackoffRetry({ baseDelayMs: 1000 });
    expect(retry.delayForAttempt(1)).toBe(1000);
    expect(retry.delayForAttempt(2)).toBe(2000);
    expect(retry.delayForAttempt(3)).toBe(4000);
  });

  it("uses default maxAttempts/baseDelayMs/sleep when not provided", async () => {
    const retry = new ExponentialBackoffRetry();
    const operation = vi.fn(async () => ok("fine"));
    const result = await retry.execute(operation);
    expect(result).toEqual(ok("fine"));
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
      await vi.advanceTimersByTimeAsync(10);
      const result = await executePromise;

      expect(result).toEqual(ok("recovered"));
      expect(operation).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns the (undefined) lastResult when constructed with maxAttempts=0 (loop never runs)", async () => {
    // Documented as "unreachable when maxAttempts >= 1" in the source — this test exercises that
    // exact edge to confirm the `as Result<...>` fallback cast at the end of `execute` is correct.
    const retry = new ExponentialBackoffRetry({ maxAttempts: 0, sleep: async () => undefined });
    const operation = vi.fn(async () => ok("never called"));
    const result = await retry.execute(operation);
    expect(result).toBeUndefined();
    expect(operation).not.toHaveBeenCalled();
  });
});
