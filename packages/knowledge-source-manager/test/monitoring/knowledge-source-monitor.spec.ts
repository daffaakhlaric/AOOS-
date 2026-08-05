import { describe, expect, it } from "vitest";

import { KnowledgeSourceCatalog } from "../../src/catalog/knowledge-source-catalog.js";
import { KnowledgeSourceMetrics } from "../../src/metrics/knowledge-source-metrics.js";
import { KnowledgeSourceMonitor } from "../../src/monitoring/knowledge-source-monitor.js";
import { KnowledgeSourceRegistry } from "../../src/registry/knowledge-source-registry.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("KnowledgeSourceMonitor", () => {
  it("samples all 8 named dashboard sections", () => {
    const registry = new KnowledgeSourceRegistry();
    const catalog = new KnowledgeSourceCatalog();
    const metrics = new KnowledgeSourceMetrics();
    catalog.register(
      metadataFixture({ sourceId: "s-1", providerId: "p-1", workspaceId: "ws-1", tenantId: "t-1" }),
    );
    metrics.setSourceCount(1);
    const monitor = new KnowledgeSourceMonitor(metrics, registry, catalog);
    const dashboard = monitor.sample();
    expect(dashboard.source).toBeDefined();
    expect(dashboard.workspace).toBeDefined();
    expect(dashboard.tenant).toBeDefined();
    expect(dashboard.namespace).toBeDefined();
    expect(dashboard.collection).toBeDefined();
    expect(dashboard.provider).toBeDefined();
    expect(dashboard.health).toBeDefined();
    expect(dashboard.usage).toBeDefined();
    expect(dashboard.sampledAt).toBeTruthy();
  });

  it("counts Sources per provider/workspace/tenant", () => {
    const registry = new KnowledgeSourceRegistry();
    const catalog = new KnowledgeSourceCatalog();
    catalog.register(
      metadataFixture({ sourceId: "s-1", providerId: "p-1", workspaceId: "ws-1", tenantId: "t-1" }),
    );
    catalog.register(
      metadataFixture({ sourceId: "s-2", providerId: "p-1", workspaceId: "ws-1", tenantId: "t-1" }),
    );
    const monitor = new KnowledgeSourceMonitor(new KnowledgeSourceMetrics(), registry, catalog);
    const dashboard = monitor.sample();
    expect(dashboard.provider.sources["p-1"]).toBe(2);
    expect(dashboard.workspace.sources["ws-1"]).toBe(2);
    expect(dashboard.tenant.sources["t-1"]).toBe(2);
  });

  it("exposes a KnowledgeSourceHealth instance", () => {
    const monitor = new KnowledgeSourceMonitor(
      new KnowledgeSourceMetrics(),
      new KnowledgeSourceRegistry(),
      new KnowledgeSourceCatalog(),
    );
    expect(monitor.health.check().status).toBeDefined();
  });
});
