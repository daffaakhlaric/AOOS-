import { describe, expect, it } from "vitest";

import { KnowledgeGeneratorHealth } from "../../src/health/knowledge-generator-health.js";
import { KnowledgeGeneratorRegistryBucket } from "../../src/registry/knowledge-generator-registry-bucket.js";
import { KnowledgeGeneratorRegistry } from "../../src/registry/knowledge-generator-registry.js";

describe("KnowledgeGeneratorHealth", () => {
  it("reports unknown registry/domain health with no data", () => {
    const health = new KnowledgeGeneratorHealth(new KnowledgeGeneratorRegistry());
    const report = health.check();
    expect(report.registry.status).toBe("unknown");
    expect(report.domain.status).toBe("unknown");
    expect(report.status).toBe("unknown");
  });

  it("reports healthy registry once entries exist", () => {
    const registry = new KnowledgeGeneratorRegistry();
    registry.register(KnowledgeGeneratorRegistryBucket.GENERATION, { id: "g-1" });
    const health = new KnowledgeGeneratorHealth(registry);
    expect(health.check().registry.status).toBe("healthy");
  });

  it("reports healthy domain with zero failures", () => {
    const health = new KnowledgeGeneratorHealth(new KnowledgeGeneratorRegistry());
    expect(health.check(10, 0).domain.status).toBe("healthy");
  });

  it("reports warning domain health for a low failure ratio", () => {
    const health = new KnowledgeGeneratorHealth(new KnowledgeGeneratorRegistry());
    expect(health.check(95, 5).domain.status).toBe("warning");
  });

  it("reports degraded domain health for a moderate failure ratio", () => {
    const health = new KnowledgeGeneratorHealth(new KnowledgeGeneratorRegistry());
    expect(health.check(70, 30).domain.status).toBe("degraded");
  });

  it("reports unavailable domain health for a high failure ratio", () => {
    const health = new KnowledgeGeneratorHealth(new KnowledgeGeneratorRegistry());
    expect(health.check(10, 90).domain.status).toBe("unavailable");
  });

  it("overall status is the worst of registry/domain", () => {
    const registry = new KnowledgeGeneratorRegistry();
    registry.register(KnowledgeGeneratorRegistryBucket.GENERATION, { id: "g-1" });
    const health = new KnowledgeGeneratorHealth(registry);
    expect(health.check(10, 90).status).toBe("unavailable");
  });
});
