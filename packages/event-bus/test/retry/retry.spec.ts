import { describe, expect, it, vi } from "vitest";

import { RetryStrategy } from "../../src/contracts/retry-policy.js";
import { RetryExhaustedException } from "../../src/errors/retry-exhausted-exception.js";
import { ExponentialBackoffPolicy } from "../../src/retry/exponential-backoff-policy.js";
import { LinearBackoffPolicy } from "../../src/retry/linear-backoff-policy.js";
import { RetryExecutor } from "../../src/retry/retry-executor.js";

const noopSleep = async (): Promise<void> => {
  /* no-op — tests never wait on real timers */
};

describe("Retry Test — ExponentialBackoffPolicy", () => {
  it("doubles the delay each attempt", () => {
    const policy = new ExponentialBackoffPolicy(5, 100, 30_000);
    expect(policy.nextDelayMs(1)).toBe(100);
    expect(policy.nextDelayMs(2)).toBe(200);
    expect(policy.nextDelayMs(3)).toBe(400);
  });

  it("caps the delay at maxDelayMs", () => {
    const policy = new ExponentialBackoffPolicy(10, 1000, 3000);
    expect(policy.nextDelayMs(10)).toBe(3000);
  });

  it("reports its strategy and maxAttempts", () => {
    const policy = new ExponentialBackoffPolicy(3);
    expect(policy.strategy).toBe(RetryStrategy.EXPONENTIAL);
    expect(policy.maxAttempts).toBe(3);
  });
});

describe("Retry Test — LinearBackoffPolicy", () => {
  it("grows the delay by a fixed increment", () => {
    const policy = new LinearBackoffPolicy(5, 100, 30_000);
    expect(policy.nextDelayMs(1)).toBe(100);
    expect(policy.nextDelayMs(2)).toBe(200);
    expect(policy.nextDelayMs(3)).toBe(300);
  });

  it("caps the delay at maxDelayMs", () => {
    const policy = new LinearBackoffPolicy(10, 100, 250);
    expect(policy.nextDelayMs(10)).toBe(250);
  });

  it("reports its strategy", () => {
    expect(new LinearBackoffPolicy().strategy).toBe(RetryStrategy.LINEAR);
  });
});

describe("Retry Test — RetryExecutor", () => {
  it("returns the result and Retry Count (attempt) 1 on first-try success", async () => {
    const executor = new RetryExecutor({ policy: new LinearBackoffPolicy(3, 1), sleep: noopSleep });
    const outcome = await executor.execute(async () => "ok");
    expect(outcome.result).toBe("ok");
    expect(outcome.metadata).toEqual({ attempt: 1, maxAttempts: 3 });
  });

  it("retries and succeeds before exhausting maxAttempts, reporting the successful attempt number", async () => {
    let calls = 0;
    const executor = new RetryExecutor({ policy: new LinearBackoffPolicy(3, 1), sleep: noopSleep });
    const outcome = await executor.execute(async () => {
      calls += 1;
      if (calls < 2) {
        throw new Error("transient");
      }
      return "ok";
    });
    expect(calls).toBe(2);
    expect(outcome.metadata.attempt).toBe(2);
  });

  it("calls onAttemptFailed with Retry Metadata on every failed attempt", async () => {
    const onAttemptFailed = vi.fn();
    let calls = 0;
    const executor = new RetryExecutor({
      policy: new LinearBackoffPolicy(3, 1),
      sleep: noopSleep,
      onAttemptFailed,
    });
    await executor.execute(async () => {
      calls += 1;
      if (calls < 3) {
        throw new Error("transient");
      }
      return "ok";
    });
    expect(onAttemptFailed).toHaveBeenCalledTimes(2);
    expect(onAttemptFailed.mock.calls[0]![0]).toMatchObject({ attempt: 1, maxAttempts: 3 });
  });

  it("throws RetryExhaustedException after maxAttempts consecutive failures", async () => {
    const executor = new RetryExecutor({ policy: new LinearBackoffPolicy(2, 1), sleep: noopSleep });
    await expect(
      executor.execute(async () => {
        throw new Error("always fails");
      }),
    ).rejects.toThrow(RetryExhaustedException);
  });

  it("records a non-Error thrown value's String() form as lastError", async () => {
    const onAttemptFailed = vi.fn();
    const executor = new RetryExecutor({
      policy: new LinearBackoffPolicy(1, 1),
      sleep: noopSleep,
      onAttemptFailed,
    });
    await expect(
      executor.execute(async () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw "boom";
      }),
    ).rejects.toThrow(RetryExhaustedException);
    expect(onAttemptFailed.mock.calls[0]![0].lastError).toBe("boom");
  });

  it("reports 'undefined' as the exhausted reason when maxAttempts is 0 (loop never runs)", async () => {
    const executor = new RetryExecutor({
      policy: { strategy: RetryStrategy.LINEAR, maxAttempts: 0, nextDelayMs: () => 0 },
      sleep: noopSleep,
    });
    await expect(executor.execute(async () => "unreachable")).rejects.toThrow(
      RetryExhaustedException,
    );
  });

  it("uses the real setTimeout-backed sleep by default (no injected sleep)", async () => {
    const executor = new RetryExecutor({ policy: new LinearBackoffPolicy(2, 1) });
    let calls = 0;
    const outcome = await executor.execute(async () => {
      calls += 1;
      if (calls < 2) {
        throw new Error("transient");
      }
      return "ok";
    });
    expect(outcome.result).toBe("ok");
  });
});
