import { describe, expect, it } from "vitest";

import { ConflictResolutionStrategyName } from "../../src/types/conflict-resolution-strategy.js";
import { KnowledgeUpdatePolicy } from "../../src/value-objects/knowledge-update-policy.js";

function baseProps() {
  return {
    id: "policy-1",
    name: "test",
    retry: { maxRetries: 3, retryDelayMs: 1000, backoffMultiplier: 2, maxBackoffDelayMs: 60_000 },
    conflictResolution: { strategy: ConflictResolutionStrategyName.LastWriteWins },
    priority: { baseWeight: 1, stalenessWeight: 1, dependencyWeight: 1 },
    dependency: { enforceOrder: true, maxChainDepth: 10 },
    freshness: { maxAgeMs: 86_400_000 },
    expiration: { expireAfterMs: 604_800_000 },
    versionCompatibility: { minVersion: "0.0.0", maxVersion: "9.9.9" },
    updateWindow: { startHourUtc: 0, endHourUtc: 0 },
    rateLimiting: { maxUpdatesPerWindow: 100, windowMs: 60_000 },
  };
}

describe("KnowledgeUpdatePolicy", () => {
  it("constructs with valid props", () => {
    const policy = new KnowledgeUpdatePolicy(baseProps());
    expect(policy.id).toBe("policy-1");
    expect(policy.retry.maxRetries).toBe(3);
  });

  it("is frozen (immutable)", () => {
    const policy = new KnowledgeUpdatePolicy(baseProps());
    expect(Object.isFrozen(policy)).toBe(true);
  });

  it("throws on empty name", () => {
    expect(() => new KnowledgeUpdatePolicy({ ...baseProps(), name: "  " })).toThrow(RangeError);
  });

  it("throws on negative maxRetries", () => {
    expect(
      () =>
        new KnowledgeUpdatePolicy({
          ...baseProps(),
          retry: { ...baseProps().retry, maxRetries: -1 },
        }),
    ).toThrow(RangeError);
  });

  it("throws on negative retryDelayMs", () => {
    expect(
      () =>
        new KnowledgeUpdatePolicy({
          ...baseProps(),
          retry: { ...baseProps().retry, retryDelayMs: -1 },
        }),
    ).toThrow(RangeError);
  });

  it("throws on backoffMultiplier below 1", () => {
    expect(
      () =>
        new KnowledgeUpdatePolicy({
          ...baseProps(),
          retry: { ...baseProps().retry, backoffMultiplier: 0.5 },
        }),
    ).toThrow(RangeError);
  });

  it("throws on out-of-range updateWindow.startHourUtc", () => {
    expect(
      () =>
        new KnowledgeUpdatePolicy({
          ...baseProps(),
          updateWindow: { startHourUtc: 24, endHourUtc: 0 },
        }),
    ).toThrow(RangeError);
  });

  it("throws on out-of-range updateWindow.endHourUtc", () => {
    expect(
      () =>
        new KnowledgeUpdatePolicy({
          ...baseProps(),
          updateWindow: { startHourUtc: 0, endHourUtc: -1 },
        }),
    ).toThrow(RangeError);
  });

  it("throws on negative rateLimiting.maxUpdatesPerWindow", () => {
    expect(
      () =>
        new KnowledgeUpdatePolicy({
          ...baseProps(),
          rateLimiting: { maxUpdatesPerWindow: -1, windowMs: 1000 },
        }),
    ).toThrow(RangeError);
  });

  describe("isWithinUpdateWindow", () => {
    it("always allows when startHourUtc === endHourUtc (no restriction)", () => {
      const policy = new KnowledgeUpdatePolicy(baseProps());
      expect(policy.isWithinUpdateWindow(0)).toBe(true);
      expect(policy.isWithinUpdateWindow(23)).toBe(true);
    });

    it("allows hours within a same-day window", () => {
      const policy = new KnowledgeUpdatePolicy({
        ...baseProps(),
        updateWindow: { startHourUtc: 9, endHourUtc: 17 },
      });
      expect(policy.isWithinUpdateWindow(9)).toBe(true);
      expect(policy.isWithinUpdateWindow(16)).toBe(true);
      expect(policy.isWithinUpdateWindow(17)).toBe(false);
      expect(policy.isWithinUpdateWindow(8)).toBe(false);
    });

    it("allows hours within a midnight-wrapping window", () => {
      const policy = new KnowledgeUpdatePolicy({
        ...baseProps(),
        updateWindow: { startHourUtc: 22, endHourUtc: 4 },
      });
      expect(policy.isWithinUpdateWindow(23)).toBe(true);
      expect(policy.isWithinUpdateWindow(0)).toBe(true);
      expect(policy.isWithinUpdateWindow(3)).toBe(true);
      expect(policy.isWithinUpdateWindow(4)).toBe(false);
      expect(policy.isWithinUpdateWindow(12)).toBe(false);
    });
  });

  describe("boundary values", () => {
    it("accepts backoffMultiplier of exactly 1", () => {
      expect(
        () =>
          new KnowledgeUpdatePolicy({
            ...baseProps(),
            retry: { ...baseProps().retry, backoffMultiplier: 1 },
          }),
      ).not.toThrow();
    });

    it("accepts maxRetries of exactly 0", () => {
      expect(
        () =>
          new KnowledgeUpdatePolicy({
            ...baseProps(),
            retry: { ...baseProps().retry, maxRetries: 0 },
          }),
      ).not.toThrow();
    });

    it("accepts updateWindow hours at the boundary (0 and 23)", () => {
      expect(
        () =>
          new KnowledgeUpdatePolicy({
            ...baseProps(),
            updateWindow: { startHourUtc: 0, endHourUtc: 23 },
          }),
      ).not.toThrow();
    });

    it("accepts rateLimiting.maxUpdatesPerWindow of exactly 0", () => {
      expect(
        () =>
          new KnowledgeUpdatePolicy({
            ...baseProps(),
            rateLimiting: { maxUpdatesPerWindow: 0, windowMs: 1000 },
          }),
      ).not.toThrow();
    });
  });

  describe("withRetry", () => {
    it("returns a new instance with retry fields merged", () => {
      const policy = new KnowledgeUpdatePolicy(baseProps());
      const updated = policy.withRetry({ maxRetries: 10 });
      expect(updated).not.toBe(policy);
      expect(updated.retry.maxRetries).toBe(10);
      expect(updated.retry.retryDelayMs).toBe(policy.retry.retryDelayMs);
      expect(policy.retry.maxRetries).toBe(3);
    });
  });
});
