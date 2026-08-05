import { describe, expect, it } from "vitest";

import { retryPolicyConfigSchema } from "../../src/contracts/retry-policy-config.js";
import { RetryStrategy } from "../../src/contracts/retry-policy.js";

describe("Schema Test — retryPolicyConfigSchema", () => {
  it("accepts a full config", () => {
    expect(
      retryPolicyConfigSchema.safeParse({
        strategy: RetryStrategy.EXPONENTIAL,
        maxAttempts: 3,
        baseDelayMs: 500,
        maxDelayMs: 5000,
      }).success,
    ).toBe(true);
  });

  it("applies default baseDelayMs/maxDelayMs when omitted", () => {
    const result = retryPolicyConfigSchema.safeParse({
      strategy: RetryStrategy.LINEAR,
      maxAttempts: 3,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.baseDelayMs).toBe(1000);
      expect(result.data.maxDelayMs).toBe(30_000);
    }
  });

  it("rejects a non-positive maxAttempts", () => {
    expect(
      retryPolicyConfigSchema.safeParse({ strategy: RetryStrategy.LINEAR, maxAttempts: 0 }).success,
    ).toBe(false);
  });

  it("rejects an unknown strategy", () => {
    expect(retryPolicyConfigSchema.safeParse({ strategy: "bogus", maxAttempts: 3 }).success).toBe(
      false,
    );
  });
});
