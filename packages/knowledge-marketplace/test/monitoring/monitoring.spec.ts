import { describe, expect, it } from "vitest";

import { KnowledgeMarketplaceMetrics } from "../../src/metrics/knowledge-marketplace-metrics.js";
import { KnowledgeMarketplaceMonitoring } from "../../src/monitoring/knowledge-marketplace-monitoring.js";
import { KnowledgeMarketplaceRegistry } from "../../src/registry/knowledge-marketplace-registry.js";

describe("KnowledgeMarketplaceMonitoring", () => {
  it("sample combines metrics and health with a timestamp", () => {
    const metrics = new KnowledgeMarketplaceMetrics();
    metrics.recordPackage();
    metrics.recordValidation(true);
    const monitoring = new KnowledgeMarketplaceMonitoring(
      metrics,
      new KnowledgeMarketplaceRegistry(),
    );

    const dashboard = monitoring.sample();

    expect(dashboard.metrics.packageCount).toBe(1);
    expect(dashboard.health.domain.status).toBe("healthy");
    expect(dashboard.sampledAt).toBeDefined();
  });

  it("reflects validation failures in domain health", () => {
    const metrics = new KnowledgeMarketplaceMetrics();
    metrics.recordValidation(false);
    metrics.recordValidation(false);
    const monitoring = new KnowledgeMarketplaceMonitoring(
      metrics,
      new KnowledgeMarketplaceRegistry(),
    );
    expect(monitoring.sample().health.domain.status).toBe("unavailable");
  });

  it("exposes a health instance", () => {
    const monitoring = new KnowledgeMarketplaceMonitoring(
      new KnowledgeMarketplaceMetrics(),
      new KnowledgeMarketplaceRegistry(),
    );
    expect(monitoring.health).toBeDefined();
  });
});
