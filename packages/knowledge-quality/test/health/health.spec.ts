import { describe, expect, it } from "vitest";

import { KnowledgeQualityHealth } from "../../src/health/knowledge-quality-health.js";
import { KnowledgeQualityRegistryBucket } from "../../src/registry/knowledge-quality-registry-bucket.js";
import { KnowledgeQualityRegistry } from "../../src/registry/knowledge-quality-registry.js";

describe("KnowledgeQualityHealth", () => {
  it("reports unknown registry/domain health with no data", () => {
    const health = new KnowledgeQualityHealth(new KnowledgeQualityRegistry());
    const report = health.check();
    expect(report.registry.status).toBe("unknown");
    expect(report.domain.status).toBe("unknown");
    expect(report.status).toBe("unknown");
  });

  it("reports healthy registry once entries exist", () => {
    const registry = new KnowledgeQualityRegistry();
    registry.register(KnowledgeQualityRegistryBucket.ASSESSMENT, { id: "g-1" });
    const health = new KnowledgeQualityHealth(registry);
    expect(health.check().registry.status).toBe("healthy");
  });

  it("reports healthy domain with zero failures", () => {
    const health = new KnowledgeQualityHealth(new KnowledgeQualityRegistry());
    expect(health.check(10, 0).domain.status).toBe("healthy");
  });

  it("reports warning domain health for a low failure ratio", () => {
    const health = new KnowledgeQualityHealth(new KnowledgeQualityRegistry());
    expect(health.check(95, 5).domain.status).toBe("warning");
  });

  it("reports degraded domain health for a moderate failure ratio", () => {
    const health = new KnowledgeQualityHealth(new KnowledgeQualityRegistry());
    expect(health.check(70, 30).domain.status).toBe("degraded");
  });

  it("reports unavailable domain health for a high failure ratio", () => {
    const health = new KnowledgeQualityHealth(new KnowledgeQualityRegistry());
    expect(health.check(10, 90).domain.status).toBe("unavailable");
  });

  it("overall status is the worst of registry/domain", () => {
    const registry = new KnowledgeQualityRegistry();
    registry.register(KnowledgeQualityRegistryBucket.ASSESSMENT, { id: "g-1" });
    const health = new KnowledgeQualityHealth(registry);
    expect(health.check(10, 90).status).toBe("unavailable");
  });
});
