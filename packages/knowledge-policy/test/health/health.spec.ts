import { describe, expect, it } from "vitest";

import { KnowledgePolicyHealth } from "../../src/health/knowledge-policy-health.js";
import { KnowledgePolicyRegistryBucket } from "../../src/registry/knowledge-policy-registry-bucket.js";
import { KnowledgePolicyRegistry } from "../../src/registry/knowledge-policy-registry.js";

describe("KnowledgePolicyHealth", () => {
  it("reports unknown registry health when nothing is registered", () => {
    const health = new KnowledgePolicyHealth(new KnowledgePolicyRegistry());
    const report = health.check();
    expect(report.registry.status).toBe("unknown");
  });

  it("reports healthy registry health when entries are registered", () => {
    const registry = new KnowledgePolicyRegistry();
    registry.register(KnowledgePolicyRegistryBucket.POLICY, { id: "p1" });
    const health = new KnowledgePolicyHealth(registry);
    expect(health.check().registry.status).toBe("healthy");
  });

  it("reports unknown domain health when no operations are recorded", () => {
    const health = new KnowledgePolicyHealth(new KnowledgePolicyRegistry());
    expect(health.check(0, 0).domain.status).toBe("unknown");
  });

  it("reports healthy domain health with zero failures", () => {
    const health = new KnowledgePolicyHealth(new KnowledgePolicyRegistry());
    expect(health.check(10, 0).domain.status).toBe("healthy");
  });

  it("reports warning domain health with a low failure ratio", () => {
    const health = new KnowledgePolicyHealth(new KnowledgePolicyRegistry());
    expect(health.check(95, 5).domain.status).toBe("warning");
  });

  it("reports degraded domain health with a moderate failure ratio", () => {
    const health = new KnowledgePolicyHealth(new KnowledgePolicyRegistry());
    expect(health.check(70, 30).domain.status).toBe("degraded");
  });

  it("reports unavailable domain health with a high failure ratio", () => {
    const health = new KnowledgePolicyHealth(new KnowledgePolicyRegistry());
    expect(health.check(10, 90).domain.status).toBe("unavailable");
  });

  it("overall status is the worst of registry/domain", () => {
    const registry = new KnowledgePolicyRegistry();
    registry.register(KnowledgePolicyRegistryBucket.POLICY, { id: "p1" });
    const health = new KnowledgePolicyHealth(registry);
    const report = health.check(10, 90);
    expect(report.status).toBe("unavailable");
  });
});
