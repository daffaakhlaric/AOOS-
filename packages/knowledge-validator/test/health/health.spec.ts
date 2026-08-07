import { describe, expect, it } from "vitest";

import { KnowledgeValidatorHealth } from "../../src/health/knowledge-validator-health.js";
import { KnowledgeValidatorRegistryBucket } from "../../src/registry/knowledge-validator-registry-bucket.js";
import { KnowledgeValidatorRegistry } from "../../src/registry/knowledge-validator-registry.js";

describe("KnowledgeValidatorHealth", () => {
  it("reports unknown registry health when nothing is registered", () => {
    const health = new KnowledgeValidatorHealth(new KnowledgeValidatorRegistry());
    expect(health.check().registry.status).toBe("unknown");
  });

  it("reports healthy registry health when entries exist", () => {
    const registry = new KnowledgeValidatorRegistry();
    registry.register(KnowledgeValidatorRegistryBucket.RULE, { id: "r-1" });
    const health = new KnowledgeValidatorHealth(registry);
    expect(health.check().registry.status).toBe("healthy");
  });

  it("reports unknown domain health with no recorded operations", () => {
    const health = new KnowledgeValidatorHealth(new KnowledgeValidatorRegistry());
    expect(health.check().domain.status).toBe("unknown");
  });

  it("reports healthy domain health at 0% failure ratio", () => {
    const health = new KnowledgeValidatorHealth(new KnowledgeValidatorRegistry());
    expect(health.check(10, 0).domain.status).toBe("healthy");
  });

  it("reports warning domain health under 10% failure ratio", () => {
    const health = new KnowledgeValidatorHealth(new KnowledgeValidatorRegistry());
    expect(health.check(95, 5).domain.status).toBe("warning");
  });

  it("reports degraded domain health under 50% failure ratio", () => {
    const health = new KnowledgeValidatorHealth(new KnowledgeValidatorRegistry());
    expect(health.check(70, 30).domain.status).toBe("degraded");
  });

  it("reports unavailable domain health at 50%+ failure ratio", () => {
    const health = new KnowledgeValidatorHealth(new KnowledgeValidatorRegistry());
    expect(health.check(10, 90).domain.status).toBe("unavailable");
  });

  it("overall status is the worst of registry/domain", () => {
    const registry = new KnowledgeValidatorRegistry();
    registry.register(KnowledgeValidatorRegistryBucket.RULE, { id: "r-1" });
    const health = new KnowledgeValidatorHealth(registry);
    const report = health.check(10, 90);
    expect(report.status).toBe("unavailable");
  });

  it("defaults successCount/failureCount to 0", () => {
    const health = new KnowledgeValidatorHealth(new KnowledgeValidatorRegistry());
    const report = health.check();
    expect(report.domain.details).toEqual({ reason: "no operations recorded yet" });
  });
});
