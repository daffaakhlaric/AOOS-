import { describe, expect, it } from "vitest";

import { KnowledgeVersionHealth } from "../../src/health/knowledge-version-health.js";
import { KnowledgeVersionRegistryBucket } from "../../src/registry/knowledge-version-registry-bucket.js";
import { KnowledgeVersionRegistry } from "../../src/registry/knowledge-version-registry.js";

describe("KnowledgeVersionHealth", () => {
  it("reports unknown registry health when nothing is registered", () => {
    const health = new KnowledgeVersionHealth(new KnowledgeVersionRegistry());
    const report = health.check();
    expect(report.registry.status).toBe("unknown");
  });

  it("reports healthy registry health when at least one bucket is populated", () => {
    const registry = new KnowledgeVersionRegistry();
    registry.register(KnowledgeVersionRegistryBucket.VERSION, { id: "v1" });
    const health = new KnowledgeVersionHealth(registry);
    expect(health.check().registry.status).toBe("healthy");
  });

  it("reports unknown domain health with no operations recorded", () => {
    const health = new KnowledgeVersionHealth(new KnowledgeVersionRegistry());
    expect(health.check(0, 0).domain.status).toBe("unknown");
  });

  it("reports healthy domain health with zero failures", () => {
    const health = new KnowledgeVersionHealth(new KnowledgeVersionRegistry());
    expect(health.check(10, 0).domain.status).toBe("healthy");
  });

  it("reports warning domain health under 10% failure ratio", () => {
    const health = new KnowledgeVersionHealth(new KnowledgeVersionRegistry());
    expect(health.check(95, 1).domain.status).toBe("warning");
  });

  it("reports degraded domain health under 50% failure ratio", () => {
    const health = new KnowledgeVersionHealth(new KnowledgeVersionRegistry());
    expect(health.check(6, 4).domain.status).toBe("degraded");
  });

  it("reports unavailable domain health at or above 50% failure ratio", () => {
    const health = new KnowledgeVersionHealth(new KnowledgeVersionRegistry());
    expect(health.check(1, 1).domain.status).toBe("unavailable");
  });

  it("overall status is the worst of registry/domain", () => {
    const registry = new KnowledgeVersionRegistry();
    registry.register(KnowledgeVersionRegistryBucket.VERSION, { id: "v1" });
    const health = new KnowledgeVersionHealth(registry);
    const report = health.check(1, 1);
    expect(report.status).toBe("unavailable");
  });
});
