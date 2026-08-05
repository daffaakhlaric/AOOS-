import { describe, expect, it } from "vitest";

import { compensationConfigSchema } from "../../src/contracts/compensation-config.js";
import { RetryBackoffStrategy, retryConfigSchema } from "../../src/contracts/retry-config.js";
import { timeoutConfigSchema } from "../../src/contracts/timeout-config.js";

describe("Schema Test — retryConfigSchema", () => {
  it("accepts a full config", () => {
    expect(
      retryConfigSchema.safeParse({
        strategy: RetryBackoffStrategy.EXPONENTIAL,
        maxAttempts: 3,
        baseDelayMs: 500,
        maxDelayMs: 5000,
      }).success,
    ).toBe(true);
  });

  it("applies defaults for baseDelayMs/maxDelayMs", () => {
    const result = retryConfigSchema.safeParse({
      strategy: RetryBackoffStrategy.LINEAR,
      maxAttempts: 2,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.baseDelayMs).toBe(1000);
      expect(result.data.maxDelayMs).toBe(30_000);
    }
  });

  it("rejects a non-positive maxAttempts", () => {
    expect(
      retryConfigSchema.safeParse({ strategy: RetryBackoffStrategy.LINEAR, maxAttempts: 0 })
        .success,
    ).toBe(false);
  });
});

describe("Schema Test — timeoutConfigSchema", () => {
  it("accepts a duration only", () => {
    expect(timeoutConfigSchema.safeParse({ durationMs: 5000 }).success).toBe(true);
  });

  it("accepts an onTimeoutTransitionId", () => {
    expect(
      timeoutConfigSchema.safeParse({ durationMs: 5000, onTimeoutTransitionId: "t-1" }).success,
    ).toBe(true);
  });

  it("rejects a non-positive duration", () => {
    expect(timeoutConfigSchema.safeParse({ durationMs: 0 }).success).toBe(false);
  });
});

describe("Schema Test — compensationConfigSchema", () => {
  it("accepts a compensationNodeId", () => {
    expect(compensationConfigSchema.safeParse({ compensationNodeId: "undo-1" }).success).toBe(true);
  });

  it("rejects a missing compensationNodeId", () => {
    expect(compensationConfigSchema.safeParse({}).success).toBe(false);
  });
});
