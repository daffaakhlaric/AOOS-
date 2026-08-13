import { err, ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import { CapiApiError } from "../../../src/domain/errors/CapiApiError.js";
import {
  ExponentialBackoffRetry,
  isRetryable,
} from "../../../src/infrastructure/retry/ExponentialBackoffRetry.js";

describe("isRetryable", () => {
  it.each([429, 500, 503])("HTTP %s is retryable", (httpStatus) => {
    expect(isRetryable(new CapiApiError("boom", { httpStatus }))).toBe(true);
  });

  it.each([400, 401, 403])("HTTP %s is NOT retryable", (httpStatus) => {
    expect(isRetryable(new CapiApiError("boom", { httpStatus }))).toBe(false);
  });

  it("an unlisted HTTP status defaults to non-retryable", () => {
    expect(isRetryable(new CapiApiError("boom", { httpStatus: 418 }))).toBe(false);
  });

  it("a network failure (no httpStatus) is retryable", () => {
    expect(isRetryable(new CapiApiError("network down"))).toBe(true);
  });
});

describe("ExponentialBackoffRetry", () => {
  it("delayForAttempt follows base * 2^(attempt-1): 1s/2s/4s", () => {
    const retry = new ExponentialBackoffRetry({ baseDelayMs: 1000 });
    expect(retry.delayForAttempt(1)).toBe(1000);
    expect(retry.delayForAttempt(2)).toBe(2000);
    expect(retry.delayForAttempt(3)).toBe(4000);
  });

  it("returns the ok result immediately without retrying", async () => {
    const sleep = vi.fn(async () => undefined);
    const retry = new ExponentialBackoffRetry({ sleep });
    const operation = vi.fn(async () => ok("value"));
    const result = await retry.execute(operation);
    expect(result).toEqual(ok("value"));
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("429 response -> retry after delay -> success", async () => {
    const sleep = vi.fn(async () => undefined);
    const retry = new ExponentialBackoffRetry({ sleep, maxAttempts: 3 });
    let attempt = 0;
    const operation = vi.fn(async () => {
      attempt += 1;
      if (attempt < 2) {
        return err(new CapiApiError("rate limited", { httpStatus: 429 }));
      }
      return ok("recovered");
    });
    const result = await retry.execute(operation);
    expect(result).toEqual(ok("recovered"));
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("3 consecutive 429 -> CapiApiError after max attempts", async () => {
    const sleep = vi.fn(async () => undefined);
    const retry = new ExponentialBackoffRetry({ sleep, maxAttempts: 3 });
    const operation = vi.fn(async () => err(new CapiApiError("rate limited", { httpStatus: 429 })));
    const result = await retry.execute(operation);
    expect(result.ok).toBe(false);
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2000);
  });

  it("400 -> immediate CapiApiError (no retry)", async () => {
    const sleep = vi.fn(async () => undefined);
    const retry = new ExponentialBackoffRetry({ sleep, maxAttempts: 3 });
    const operation = vi.fn(async () => err(new CapiApiError("bad request", { httpStatus: 400 })));
    const result = await retry.execute(operation);
    expect(result.ok).toBe(false);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("uses the real setTimeout-based sleep by default", async () => {
    vi.useFakeTimers();
    try {
      const retry = new ExponentialBackoffRetry({ maxAttempts: 2, baseDelayMs: 10 });
      let attempt = 0;
      const promise = retry.execute(async () => {
        attempt += 1;
        if (attempt < 2) {
          return err(new CapiApiError("rate limited", { httpStatus: 429 }));
        }
        return ok("done");
      });
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result).toEqual(ok("done"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("maxAttempts=0 never calls operation, falling through to the (undefined) lastResult guard", async () => {
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined, maxAttempts: 0 });
    const operation = vi.fn(async () => ok("unreachable"));
    const result = await retry.execute(operation);
    expect(operation).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
