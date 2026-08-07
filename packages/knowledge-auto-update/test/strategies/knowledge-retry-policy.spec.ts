import { describe, expect, it } from "vitest";

import { KnowledgeRetryPolicy } from "../../src/strategies/knowledge-retry-policy.js";

const retry = { maxRetries: 3, retryDelayMs: 100, backoffMultiplier: 2, maxBackoffDelayMs: 10_000 };

describe("KnowledgeRetryPolicy", () => {
  it("allows retry while attempt < maxRetries", () => {
    const policy = new KnowledgeRetryPolicy();
    expect(policy.shouldRetry(0, retry)).toBe(true);
    expect(policy.shouldRetry(2, retry)).toBe(true);
  });

  it("disallows retry once attempt reaches maxRetries", () => {
    const policy = new KnowledgeRetryPolicy();
    expect(policy.shouldRetry(3, retry)).toBe(false);
    expect(policy.shouldRetry(10, retry)).toBe(false);
  });

  it("computes the next attempt delay via the backoff strategy", () => {
    const policy = new KnowledgeRetryPolicy();
    expect(policy.nextAttemptDelay(0, retry)).toBe(100);
    expect(policy.nextAttemptDelay(1, retry)).toBe(200);
  });

  it("shouldRetry is false right at the boundary attempt === maxRetries", () => {
    const policy = new KnowledgeRetryPolicy();
    expect(policy.shouldRetry(retry.maxRetries, retry)).toBe(false);
    expect(policy.shouldRetry(retry.maxRetries - 1, retry)).toBe(true);
  });
});
