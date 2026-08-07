import { describe, expect, it } from "vitest";

import { KnowledgeQualityMetrics } from "../../src/metrics/knowledge-quality-metrics.js";
import { KnowledgeQualityMonitoring } from "../../src/monitoring/knowledge-quality-monitoring.js";
import { KnowledgeQualityRegistry } from "../../src/registry/knowledge-quality-registry.js";

describe("KnowledgeQualityMonitoring", () => {
  it("sample() combines Metrics + Health into one dashboard", () => {
    const metrics = new KnowledgeQualityMetrics();
    const monitoring = new KnowledgeQualityMonitoring(metrics, new KnowledgeQualityRegistry());
    const dashboard = monitoring.sample();
    expect(dashboard.metrics.assessmentCount).toBe(0);
    expect(dashboard.health.status).toBe("unknown");
    expect(dashboard.sampledAt).toBeDefined();
  });

  it("derives domain health from validation success/failure counters", () => {
    const metrics = new KnowledgeQualityMetrics();
    for (let i = 0; i < 19; i += 1) {
      metrics.recordValidation(true);
    }
    metrics.recordValidation(false);
    const monitoring = new KnowledgeQualityMonitoring(metrics, new KnowledgeQualityRegistry());
    expect(monitoring.sample().health.domain.status).toBe("warning");
  });

  it("exposes a nested health checker instance", () => {
    const metrics = new KnowledgeQualityMetrics();
    const monitoring = new KnowledgeQualityMonitoring(metrics, new KnowledgeQualityRegistry());
    expect(monitoring.health).toBeDefined();
  });
});
