import { describe, expect, it } from "vitest";

import { RetryStrategy } from "../../src/contracts/retry-policy.js";
import { ExponentialBackoffPolicy } from "../../src/retry/exponential-backoff-policy.js";
import { LinearBackoffPolicy } from "../../src/retry/linear-backoff-policy.js";
import { createRetryPolicy } from "../../src/retry/retry-policy-factory.js";

describe("Retry Test — ExponentialBackoffPolicy", () => {
  it("doubles the delay each attempt", () => {
    const policy = new ExponentialBackoffPolicy(5, 1000, 60_000);
    expect(policy.nextDelayMs(1)).toBe(1000);
    expect(policy.nextDelayMs(2)).toBe(2000);
    expect(policy.nextDelayMs(3)).toBe(4000);
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
    const policy = new LinearBackoffPolicy(5, 1000, 60_000);
    expect(policy.nextDelayMs(1)).toBe(1000);
    expect(policy.nextDelayMs(2)).toBe(2000);
    expect(policy.nextDelayMs(3)).toBe(3000);
  });

  it("caps the delay at maxDelayMs", () => {
    const policy = new LinearBackoffPolicy(10, 1000, 2500);
    expect(policy.nextDelayMs(10)).toBe(2500);
  });

  it("reports its strategy", () => {
    expect(new LinearBackoffPolicy().strategy).toBe(RetryStrategy.LINEAR);
  });
});

describe("Retry Test — createRetryPolicy factory", () => {
  it("builds an ExponentialBackoffPolicy from an Exponential config", () => {
    const policy = createRetryPolicy({
      strategy: RetryStrategy.EXPONENTIAL,
      maxAttempts: 4,
      baseDelayMs: 500,
      maxDelayMs: 10_000,
    });
    expect(policy.strategy).toBe(RetryStrategy.EXPONENTIAL);
    expect(policy.maxAttempts).toBe(4);
    expect(policy.nextDelayMs(2)).toBe(1000);
  });

  it("builds a LinearBackoffPolicy from a Linear config", () => {
    const policy = createRetryPolicy({
      strategy: RetryStrategy.LINEAR,
      maxAttempts: 3,
      baseDelayMs: 200,
      maxDelayMs: 10_000,
    });
    expect(policy.strategy).toBe(RetryStrategy.LINEAR);
    expect(policy.nextDelayMs(2)).toBe(400);
  });
});
