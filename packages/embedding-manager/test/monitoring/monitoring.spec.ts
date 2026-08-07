import { describe, expect, it } from "vitest";

import { EmbeddingMetrics } from "../../src/metrics/embedding-metrics.js";
import { EmbeddingMonitoring } from "../../src/monitoring/embedding-monitoring.js";
import { EmbeddingRegistry } from "../../src/registry/embedding-registry.js";

describe("EmbeddingMonitoring", () => {
  it("sample() combines a metrics snapshot and a health report", () => {
    const metrics = new EmbeddingMetrics();
    const monitoring = new EmbeddingMonitoring(metrics, new EmbeddingRegistry());
    const dashboard = monitoring.sample();
    expect(dashboard.metrics).toBeDefined();
    expect(dashboard.health).toBeDefined();
    expect(dashboard.sampledAt).toBeDefined();
  });

  it("derives domain health from check pass/fail counts", () => {
    const metrics = new EmbeddingMetrics();
    for (let i = 0; i < 19; i += 1) metrics.recordCheck(true);
    metrics.recordCheck(false);
    const monitoring = new EmbeddingMonitoring(metrics, new EmbeddingRegistry());
    expect(monitoring.sample().health.domain.status).toBe("warning");
  });

  it("exposes the underlying EmbeddingHealth instance", () => {
    const monitoring = new EmbeddingMonitoring(new EmbeddingMetrics(), new EmbeddingRegistry());
    expect(monitoring.health).toBeDefined();
  });
});
