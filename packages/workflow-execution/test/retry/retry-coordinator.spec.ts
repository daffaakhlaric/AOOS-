import { describe, expect, it } from "vitest";

import { RetryExhaustedException } from "../../src/errors/retry-exhausted-exception.js";
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

  it("computeDelayMs() scales linearly for LINEAR", () => {
    const coordinator = new RetryCoordinator();
    const policy: RetryPolicy = {
      strategy: RetryStrategy.LINEAR,
      maxAttempts: 3,
      baseDelayMs: 100,
    };
    expect(coordinator.computeDelayMs(policy, 1)).toBe(100);
    expect(coordinator.computeDelayMs(policy, 3)).toBe(300);
  });

  it("computeDelayMs() defaults baseDelayMs to 1000 for LINEAR when omitted", () => {
    const coordinator = new RetryCoordinator();
    const policy: RetryPolicy = { strategy: RetryStrategy.LINEAR, maxAttempts: 3 };
    expect(coordinator.computeDelayMs(policy, 2)).toBe(2000);
  });

  it("computeDelayMs() defaults baseDelayMs/maxDelayMs for EXPONENTIAL when omitted", () => {
    const coordinator = new RetryCoordinator();
    const policy: RetryPolicy = { strategy: RetryStrategy.EXPONENTIAL, maxAttempts: 3 };
    expect(coordinator.computeDelayMs(policy, 1)).toBe(1000);
  });

  it("uses a real SystemClock by default (lastAttemptAt is a valid ISO timestamp)", () => {
    const coordinator = new RetryCoordinator();
    const policy: RetryPolicy = { strategy: RetryStrategy.IMMEDIATE, maxAttempts: 3 };
    coordinator.recordAttempt("node-1", policy);
    const state = coordinator.getState("node-1");
    expect(state?.lastAttemptAt).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(state!.lastAttemptAt))).toBe(false);
  });

  it("computeDelayMs() doubles for EXPONENTIAL, capped by maxDelayMs", () => {
    const coordinator = new RetryCoordinator();
    const policy: RetryPolicy = {
      strategy: RetryStrategy.EXPONENTIAL,
      maxAttempts: 5,
      baseDelayMs: 100,
      maxDelayMs: 300,
    };
    expect(coordinator.computeDelayMs(policy, 1)).toBe(100);
    expect(coordinator.computeDelayMs(policy, 2)).toBe(200);
    expect(coordinator.computeDelayMs(policy, 3)).toBe(300);
    expect(coordinator.computeDelayMs(policy, 4)).toBe(300);
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

  it("computeDelayMs() throws RetryExhaustedException for CUSTOM with no customDelayFn", () => {
    const coordinator = new RetryCoordinator();
    const policy: RetryPolicy = { strategy: RetryStrategy.CUSTOM, maxAttempts: 3 };
    expect(() => coordinator.computeDelayMs(policy, 1)).toThrow(RetryExhaustedException);
  });

  it("recordAttempt() increments attempt count per Node id and uses the injected clock", () => {
    const coordinator = new RetryCoordinator(new FixedClock(1_700_000_000_000));
    const policy: RetryPolicy = { strategy: RetryStrategy.IMMEDIATE, maxAttempts: 3 };
    const first = coordinator.recordAttempt("node-1", policy);
    const second = coordinator.recordAttempt("node-1", policy);
    expect(first.attempt).toBe(1);
    expect(second.attempt).toBe(2);
    expect(coordinator.getState("node-1")?.lastAttemptAt).toBe(
      new Date(1_700_000_000_000).toISOString(),
    );
  });

  it("recordAttempt() throws RetryExhaustedException once maxAttempts is exceeded", () => {
    const coordinator = new RetryCoordinator();
    const policy: RetryPolicy = { strategy: RetryStrategy.IMMEDIATE, maxAttempts: 1 };
    coordinator.recordAttempt("node-1", policy);
    expect(() => coordinator.recordAttempt("node-1", policy)).toThrow(RetryExhaustedException);
  });

  it("tracks separate Retry State per Node id", () => {
    const coordinator = new RetryCoordinator();
    const policy: RetryPolicy = { strategy: RetryStrategy.IMMEDIATE, maxAttempts: 3 };
    coordinator.recordAttempt("node-1", policy);
    expect(coordinator.getState("node-2")).toBeUndefined();
  });

  it("reset() clears the Retry State for a Node id", () => {
    const coordinator = new RetryCoordinator();
    const policy: RetryPolicy = { strategy: RetryStrategy.IMMEDIATE, maxAttempts: 3 };
    coordinator.recordAttempt("node-1", policy);
    coordinator.reset("node-1");
    expect(coordinator.getState("node-1")).toBeUndefined();
  });
});
