import { describe, expect, it } from "vitest";

import { EmbeddingMetrics } from "../../src/metrics/embedding-metrics.js";
import { EmbeddingMonitoring } from "../../src/monitoring/embedding-monitoring.js";
import { EmbeddingRegistryBucket } from "../../src/registry/embedding-registry-bucket.js";
import { EmbeddingRegistry } from "../../src/registry/embedding-registry.js";

describe("EmbeddingMonitoring — extra scenarios", () => {
  it("sample() reflects a registry that has entries in multiple buckets", () => {
    const registry = new EmbeddingRegistry();
    registry.register(EmbeddingRegistryBucket.PROVIDER, { id: "p-1" });
    registry.register(EmbeddingRegistryBucket.MODEL, { id: "m-1" });
    const monitoring = new EmbeddingMonitoring(new EmbeddingMetrics(), registry);
    expect(monitoring.sample().health.registry.status).toBe("healthy");
  });

  it("sample() reports a fully healthy dashboard with only successful checks", () => {
    const metrics = new EmbeddingMetrics();
    metrics.recordCheck(true);
    metrics.recordCheck(true);
    const registry = new EmbeddingRegistry();
    registry.register(EmbeddingRegistryBucket.PROVIDER, { id: "p-1" });
    const monitoring = new EmbeddingMonitoring(metrics, registry);
    const dashboard = monitoring.sample();
    expect(dashboard.health.status).toBe("healthy");
  });

  it("sampledAt is a valid ISO timestamp", () => {
    const monitoring = new EmbeddingMonitoring(new EmbeddingMetrics(), new EmbeddingRegistry());
    const dashboard = monitoring.sample();
    expect(Number.isNaN(Date.parse(dashboard.sampledAt))).toBe(false);
  });
});
