import { describe, expect, it } from "vitest";

import { KnowledgePolicyMetrics } from "../../src/metrics/knowledge-policy-metrics.js";
import { KnowledgePolicyMonitoring } from "../../src/monitoring/knowledge-policy-monitoring.js";
import { KnowledgePolicyRegistry } from "../../src/registry/knowledge-policy-registry.js";

describe("KnowledgePolicyMonitoring", () => {
  it("composes Metrics + Health into one dashboard sample", () => {
    const metrics = new KnowledgePolicyMetrics();
    const monitoring = new KnowledgePolicyMonitoring(metrics, new KnowledgePolicyRegistry());
    const dashboard = monitoring.sample();
    expect(dashboard.metrics).toEqual(metrics.snapshot());
    expect(dashboard.health).toBeTruthy();
    expect(dashboard.sampledAt).toBeTruthy();
  });

  it("derives domain health from validation success/failure counts", () => {
    const metrics = new KnowledgePolicyMetrics();
    for (let i = 0; i < 19; i += 1) {
      metrics.recordValidation(true);
    }
    metrics.recordValidation(false);
    const monitoring = new KnowledgePolicyMonitoring(metrics, new KnowledgePolicyRegistry());
    const dashboard = monitoring.sample();
    expect(dashboard.health.domain.status).toBe("warning");
  });

  it("exposes a health instance", () => {
    const monitoring = new KnowledgePolicyMonitoring(
      new KnowledgePolicyMetrics(),
      new KnowledgePolicyRegistry(),
    );
    expect(monitoring.health).toBeTruthy();
  });
});
