import { describe, expect, it } from "vitest";

import { EmbeddingHealth } from "../../src/health/embedding-health.js";
import { EmbeddingRegistryBucket } from "../../src/registry/embedding-registry-bucket.js";
import { EmbeddingRegistry } from "../../src/registry/embedding-registry.js";

describe("EmbeddingHealth", () => {
  it("reports unknown registry/domain health with no data", () => {
    const health = new EmbeddingHealth(new EmbeddingRegistry());
    const report = health.check();
    expect(report.registry.status).toBe("unknown");
    expect(report.domain.status).toBe("unknown");
    expect(report.status).toBe("unknown");
  });

  it("reports healthy registry once entries exist", () => {
    const registry = new EmbeddingRegistry();
    registry.register(EmbeddingRegistryBucket.PROVIDER, { id: "p-1" });
    const health = new EmbeddingHealth(registry);
    expect(health.check().registry.status).toBe("healthy");
  });

  it("reports healthy domain with a 0% failure ratio", () => {
    const health = new EmbeddingHealth(new EmbeddingRegistry());
    expect(health.check(10, 0).domain.status).toBe("healthy");
  });

  it("reports warning domain under 10% failure ratio", () => {
    const health = new EmbeddingHealth(new EmbeddingRegistry());
    expect(health.check(95, 5).domain.status).toBe("warning");
  });

  it("reports degraded domain under 50% failure ratio", () => {
    const health = new EmbeddingHealth(new EmbeddingRegistry());
    expect(health.check(60, 40).domain.status).toBe("degraded");
  });

  it("reports unavailable domain at/above 50% failure ratio", () => {
    const health = new EmbeddingHealth(new EmbeddingRegistry());
    expect(health.check(10, 90).domain.status).toBe("unavailable");
  });

  it("overall status is the worst of registry/domain", () => {
    const registry = new EmbeddingRegistry();
    registry.register(EmbeddingRegistryBucket.PROVIDER, { id: "p-1" });
    const health = new EmbeddingHealth(registry);
    expect(health.check(10, 90).status).toBe("unavailable");
  });
});
