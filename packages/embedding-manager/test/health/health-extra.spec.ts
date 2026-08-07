import { describe, expect, it } from "vitest";

import { EmbeddingHealth } from "../../src/health/embedding-health.js";
import { EmbeddingRegistryBucket } from "../../src/registry/embedding-registry-bucket.js";
import { EmbeddingRegistry } from "../../src/registry/embedding-registry.js";

describe("EmbeddingHealth — boundary ratios", () => {
  it("exactly 10% failure ratio is degraded (not warning)", () => {
    const health = new EmbeddingHealth(new EmbeddingRegistry());
    expect(health.check(90, 10).domain.status).toBe("degraded");
  });

  it("just under 10% failure ratio is warning", () => {
    const health = new EmbeddingHealth(new EmbeddingRegistry());
    expect(health.check(92, 8).domain.status).toBe("warning");
  });

  it("exactly 50% failure ratio is unavailable (not degraded)", () => {
    const health = new EmbeddingHealth(new EmbeddingRegistry());
    expect(health.check(50, 50).domain.status).toBe("unavailable");
  });

  it("just under 50% failure ratio is degraded", () => {
    const health = new EmbeddingHealth(new EmbeddingRegistry());
    expect(health.check(51, 49).domain.status).toBe("degraded");
  });

  it("registry health counts entries across all 8 buckets combined", () => {
    const registry = new EmbeddingRegistry();
    registry.register(EmbeddingRegistryBucket.PROVIDER, { id: "p-1" });
    registry.register(EmbeddingRegistryBucket.MODEL, { id: "m-1" });
    const health = new EmbeddingHealth(registry);
    expect(health.check().registry.details).toEqual({ count: 2 });
  });

  it("details are populated for both healthy and unknown outcomes", () => {
    const health = new EmbeddingHealth(new EmbeddingRegistry());
    const report = health.check();
    expect(report.registry.details).toBeDefined();
    expect(report.domain.details).toBeDefined();
  });
});
