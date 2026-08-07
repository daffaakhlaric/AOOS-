import { describe, expect, it } from "vitest";

import { KnowledgeVersionMetrics } from "../../src/metrics/knowledge-version-metrics.js";
import { KnowledgeVersionMonitoring } from "../../src/monitoring/knowledge-version-monitoring.js";
import { KnowledgeVersionRegistryBucket } from "../../src/registry/knowledge-version-registry-bucket.js";
import { KnowledgeVersionRegistry } from "../../src/registry/knowledge-version-registry.js";

describe("KnowledgeVersionMonitoring", () => {
  it("combines a metrics snapshot and a health report with a sampledAt timestamp", () => {
    const metrics = new KnowledgeVersionMetrics();
    const registry = new KnowledgeVersionRegistry();
    const monitoring = new KnowledgeVersionMonitoring(metrics, registry);
    const dashboard = monitoring.sample();
    expect(dashboard.metrics.versionCount).toBe(0);
    expect(dashboard.health.status).toBe("unknown");
    expect(dashboard.sampledAt).toBeTruthy();
  });

  it("derives domain health from validation success/failure counters", () => {
    const metrics = new KnowledgeVersionMetrics();
    const registry = new KnowledgeVersionRegistry();
    registry.register(KnowledgeVersionRegistryBucket.VERSION, { id: "v1" });
    metrics.recordValidation(true);
    metrics.recordValidation(true);
    const monitoring = new KnowledgeVersionMonitoring(metrics, registry);
    const dashboard = monitoring.sample();
    expect(dashboard.health.domain.status).toBe("healthy");
    expect(dashboard.health.status).toBe("healthy");
  });

  it("exposes the underlying health instance", () => {
    const metrics = new KnowledgeVersionMetrics();
    const registry = new KnowledgeVersionRegistry();
    const monitoring = new KnowledgeVersionMonitoring(metrics, registry);
    expect(monitoring.health.check()).toBeTruthy();
  });
});
