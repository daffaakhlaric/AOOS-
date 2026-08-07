import { describe, expect, it } from "vitest";

import { KnowledgeValidatorMetrics } from "../../src/metrics/knowledge-validator-metrics.js";
import { KnowledgeValidatorMonitoring } from "../../src/monitoring/knowledge-validator-monitoring.js";
import { KnowledgeValidatorRegistry } from "../../src/registry/knowledge-validator-registry.js";

describe("KnowledgeValidatorMonitoring", () => {
  it("samples metrics + health + a timestamp", () => {
    const monitoring = new KnowledgeValidatorMonitoring(
      new KnowledgeValidatorMetrics(),
      new KnowledgeValidatorRegistry(),
    );
    const dashboard = monitoring.sample();
    expect(dashboard.metrics).toBeDefined();
    expect(dashboard.health).toBeDefined();
    expect(dashboard.sampledAt).toBeDefined();
  });

  it("derives domain health from checkCount/checkFailureCount", () => {
    const metrics = new KnowledgeValidatorMetrics();
    metrics.recordCheck(true);
    metrics.recordCheck(true);
    metrics.recordCheck(true);
    metrics.recordCheck(false);
    const monitoring = new KnowledgeValidatorMonitoring(metrics, new KnowledgeValidatorRegistry());
    expect(monitoring.sample().health.domain.status).toBe("degraded");
  });

  it("exposes a health instance", () => {
    const monitoring = new KnowledgeValidatorMonitoring(
      new KnowledgeValidatorMetrics(),
      new KnowledgeValidatorRegistry(),
    );
    expect(monitoring.health).toBeDefined();
  });
});
