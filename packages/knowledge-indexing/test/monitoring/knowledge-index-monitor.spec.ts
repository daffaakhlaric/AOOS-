import { describe, expect, it } from "vitest";

import { KnowledgeIndexBuilder } from "../../src/builder/knowledge-index-builder.js";
import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { KnowledgeIndexMetrics } from "../../src/metrics/knowledge-index-metrics.js";
import { KnowledgeIndexMonitor } from "../../src/monitoring/knowledge-index-monitor.js";
import { KnowledgeIndexRegistryBucket } from "../../src/registry/knowledge-index-registry-bucket.js";
import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Monitoring Test — KnowledgeIndexMonitor", () => {
  it("sample() combines Metrics + Health into one Dashboard", () => {
    const registry = new KnowledgeIndexRegistry();
    const asset = assetFixture();
    const [entry] = new KnowledgeIndexBuilder().build(
      asset,
      KnowledgeIndexType.KEYWORD,
      contextFixture(asset),
    );
    registry.register(KnowledgeIndexRegistryBucket.INDEX, entry!);
    const metrics = new KnowledgeIndexMetrics();
    metrics.recordEntryBuilt(KnowledgeIndexType.KEYWORD);
    metrics.recordBuildCompleted(5);
    metrics.recordTenantUsage("tenant-1");
    metrics.recordWorkspaceUsage("ws-1");

    const monitor = new KnowledgeIndexMonitor(metrics, registry);
    const dashboard = monitor.sample();

    expect(dashboard.index.count).toBe(1);
    expect(dashboard.build).toEqual({ count: 1, failures: 0, averageBuildTimeMs: 5 });
    expect(dashboard.tenant.usage).toEqual({ "tenant-1": 1 });
    expect(dashboard.workspace.usage).toEqual({ "ws-1": 1 });
    expect(dashboard.sampledAt).toEqual(expect.any(String));
    expect(dashboard.health).toBeDefined();
    expect(dashboard.metrics).toBeDefined();
  });

  it("exposes a shared KnowledgeIndexHealth instance via the health property", () => {
    const monitor = new KnowledgeIndexMonitor(
      new KnowledgeIndexMetrics(),
      new KnowledgeIndexRegistry(),
    );
    expect(monitor.health.check().status).toBe("unknown");
  });
});
