import { describe, expect, it } from "vitest";

import { RetryStrategy } from "../../src/contracts/retry-policy.js";
import { RetryValidator } from "../../src/validator/retry-validator.js";
import { createJobInputFixture } from "../helpers/create-job-input-fixture.js";

describe("Validation Test — RetryValidator", () => {
  it("passes when no retryPolicyConfig is set", () => {
    expect(new RetryValidator().validate(createJobInputFixture(), {}).valid).toBe(true);
  });

  it("passes a sane config", () => {
    const input = createJobInputFixture({
      retryPolicyConfig: {
        strategy: RetryStrategy.LINEAR,
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30_000,
      },
    });
    expect(new RetryValidator().validate(input, {}).valid).toBe(true);
  });

  it("fails when baseDelayMs exceeds maxDelayMs", () => {
    const input = createJobInputFixture({
      retryPolicyConfig: {
        strategy: RetryStrategy.LINEAR,
        maxAttempts: 3,
        baseDelayMs: 50_000,
        maxDelayMs: 30_000,
      },
    });
    const result = new RetryValidator().validate(input, {});
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("retryPolicyConfig.baseDelayMs");
  });
});
