import { describe, expect, it } from "vitest";

import { IntegrationRetryExhaustedException } from "../../src/errors/integration-retry-exhausted-exception.js";
import { RetryCoordinator } from "../../src/retry/retry-coordinator.js";
import { RetryStrategy, type RetryPolicy } from "../../src/retry/retry-policy.js";
import type { IClock } from "../../src/utils/i-clock.js";

class FixedClock implements IClock {
  constructor(private readonly value: number) {}
  now(): number {
    return this.value;
  }
}

describe("Retry Test — RetryCoordinator", () => {
  it("computeDelayMs() returns 0 for IMMEDIATE", () => {
    const coordinator = new RetryCoordinator();
    const policy: RetryPolicy = { strategy: RetryStrategy.IMMEDIATE, maxAttempts: 3 };
    expect(coordinator.computeDelayMs(policy, 1)).toBe(0);
  });

  it("computeDelayMs() scales linearly for LINEAR, defaulting baseDelayMs to 1000", () => {
    const coordinator = new RetryCoordinator();
    const custom: RetryPolicy = {
      strategy: RetryStrategy.LINEAR,
      maxAttempts: 3,
      baseDelayMs: 100,
    };
    expect(coordinator.computeDelayMs(custom, 3)).toBe(300);
    const defaulted: RetryPolicy = { strategy: RetryStrategy.LINEAR, maxAttempts: 3 };
    expect(coordinator.computeDelayMs(defaulted, 2)).toBe(2000);
  });

  it("computeDelayMs() doubles for EXPONENTIAL, capped by maxDelayMs, with defaults", () => {
    const coordinator = new RetryCoordinator();
    const policy: RetryPolicy = {
      strategy: RetryStrategy.EXPONENTIAL,
      maxAttempts: 5,
      baseDelayMs: 100,
      maxDelayMs: 300,
    };
    expect(coordinator.computeDelayMs(policy, 1)).toBe(100);
    expect(coordinator.computeDelayMs(policy, 3)).toBe(300);
    const defaulted: RetryPolicy = { strategy: RetryStrategy.EXPONENTIAL, maxAttempts: 5 };
    expect(coordinator.computeDelayMs(defaulted, 1)).toBe(1000);
  });

  it("computeDelayMs() invokes customDelayFn for CUSTOM", () => {
    const coordinator = new RetryCoordinator();
    const policy: RetryPolicy = {
      strategy: RetryStrategy.CUSTOM,
      maxAttempts: 3,
      customDelayFn: (attempt) => attempt * 50,
    };
    expect(coordinator.computeDelayMs(policy, 2)).toBe(100);
  });

  it("computeDelayMs() throws IntegrationRetryExhaustedException for CUSTOM with no customDelayFn", () => {
    const coordinator = new RetryCoordinator();
    const policy: RetryPolicy = { strategy: RetryStrategy.CUSTOM, maxAttempts: 3 };
    expect(() => coordinator.computeDelayMs(policy, 1)).toThrow(IntegrationRetryExhaustedException);
  });

  it("recordAttempt() increments the attempt count per key and uses the injected clock", () => {
    const coordinator = new RetryCoordinator(new FixedClock(1_700_000_000_000));
    const policy: RetryPolicy = { strategy: RetryStrategy.IMMEDIATE, maxAttempts: 3 };
    const first = coordinator.recordAttempt("capability", policy);
    const second = coordinator.recordAttempt("capability", policy);
    expect(first.attempt).toBe(1);
    expect(second.attempt).toBe(2);
    expect(coordinator.getState("capability")?.lastAttemptAt).toBe(
      new Date(1_700_000_000_000).toISOString(),
    );
  });

  it("recordAttempt() throws IntegrationRetryExhaustedException once maxAttempts is exceeded", () => {
    const coordinator = new RetryCoordinator();
    const policy: RetryPolicy = { strategy: RetryStrategy.IMMEDIATE, maxAttempts: 1 };
    coordinator.recordAttempt("capability", policy);
    expect(() => coordinator.recordAttempt("capability", policy)).toThrow(
      IntegrationRetryExhaustedException,
    );
  });

  it("tracks separate Retry State per key", () => {
    const coordinator = new RetryCoordinator();
    coordinator.recordAttempt("capability", { strategy: RetryStrategy.IMMEDIATE, maxAttempts: 3 });
    expect(coordinator.getState("tool")).toBeUndefined();
  });

  it("reset() clears the Retry State for a key", () => {
    const coordinator = new RetryCoordinator();
    coordinator.recordAttempt("capability", { strategy: RetryStrategy.IMMEDIATE, maxAttempts: 3 });
    coordinator.reset("capability");
    expect(coordinator.getState("capability")).toBeUndefined();
  });

  it("uses a real SystemClock by default (lastAttemptAt is a valid ISO timestamp)", () => {
    const coordinator = new RetryCoordinator();
    coordinator.recordAttempt("capability", { strategy: RetryStrategy.IMMEDIATE, maxAttempts: 3 });
    const state = coordinator.getState("capability");
    expect(Number.isNaN(Date.parse(state!.lastAttemptAt))).toBe(false);
  });
});
