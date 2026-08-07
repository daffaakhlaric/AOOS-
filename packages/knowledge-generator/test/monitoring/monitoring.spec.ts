import { describe, expect, it } from "vitest";

import { KnowledgeGeneratorMetrics } from "../../src/metrics/knowledge-generator-metrics.js";
import { KnowledgeGeneratorMonitoring } from "../../src/monitoring/knowledge-generator-monitoring.js";
import { KnowledgeGeneratorRegistry } from "../../src/registry/knowledge-generator-registry.js";

describe("KnowledgeGeneratorMonitoring", () => {
  it("sample() combines Metrics + Health into one dashboard", () => {
    const metrics = new KnowledgeGeneratorMetrics();
    const monitoring = new KnowledgeGeneratorMonitoring(metrics, new KnowledgeGeneratorRegistry());
    const dashboard = monitoring.sample();
    expect(dashboard.metrics.generationCount).toBe(0);
    expect(dashboard.health.status).toBe("unknown");
    expect(dashboard.sampledAt).toBeDefined();
  });

  it("derives domain health from validation success/failure counters", () => {
    const metrics = new KnowledgeGeneratorMetrics();
    for (let i = 0; i < 19; i += 1) {
      metrics.recordValidation(true);
    }
    metrics.recordValidation(false);
    const monitoring = new KnowledgeGeneratorMonitoring(metrics, new KnowledgeGeneratorRegistry());
    expect(monitoring.sample().health.domain.status).toBe("warning");
  });

  it("exposes a nested health checker instance", () => {
    const metrics = new KnowledgeGeneratorMetrics();
    const monitoring = new KnowledgeGeneratorMonitoring(metrics, new KnowledgeGeneratorRegistry());
    expect(monitoring.health).toBeDefined();
  });
});
