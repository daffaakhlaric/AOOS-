import { describe, expect, it } from "vitest";

import { KnowledgeUpdatePolicyFactory } from "../../src/factories/knowledge-update-policy-factory.js";
import { ConflictResolutionStrategyName } from "../../src/types/conflict-resolution-strategy.js";

describe("KnowledgeUpdatePolicyFactory", () => {
  it("creates a policy with sensible defaults", () => {
    const policy = new KnowledgeUpdatePolicyFactory().create({ name: "my-policy" });
    expect(policy.name).toBe("my-policy");
    expect(policy.retry.maxRetries).toBe(3);
    expect(policy.retry.backoffMultiplier).toBe(2);
    expect(policy.conflictResolution.strategy).toBe(ConflictResolutionStrategyName.LastWriteWins);
  });

  it("honors overrides", () => {
    const policy = new KnowledgeUpdatePolicyFactory().create({
      name: "custom",
      maxRetries: 5,
      retryDelayMs: 2000,
      backoffMultiplier: 3,
      maxBackoffDelayMs: 10_000,
      conflictResolutionStrategy: ConflictResolutionStrategyName.VersionPriority,
      maxAgeMs: 1000,
      expireAfterMs: 2000,
    });
    expect(policy.retry.maxRetries).toBe(5);
    expect(policy.retry.retryDelayMs).toBe(2000);
    expect(policy.retry.backoffMultiplier).toBe(3);
    expect(policy.retry.maxBackoffDelayMs).toBe(10_000);
    expect(policy.conflictResolution.strategy).toBe(ConflictResolutionStrategyName.VersionPriority);
    expect(policy.freshness.maxAgeMs).toBe(1000);
    expect(policy.expiration.expireAfterMs).toBe(2000);
  });

  it("generates unique policy ids", () => {
    const factory = new KnowledgeUpdatePolicyFactory();
    const a = factory.create({ name: "a" });
    const b = factory.create({ name: "b" });
    expect(a.id).not.toBe(b.id);
  });

  it("defaultPolicy() returns a valid policy named 'default'", () => {
    const policy = KnowledgeUpdatePolicyFactory.defaultPolicy();
    expect(policy.name).toBe("default");
  });

  it("defaultPolicy() has sane default rate-limiting and dependency rules", () => {
    const policy = KnowledgeUpdatePolicyFactory.defaultPolicy();
    expect(policy.rateLimiting.maxUpdatesPerWindow).toBeGreaterThan(0);
    expect(policy.dependency.enforceOrder).toBe(true);
  });
});
