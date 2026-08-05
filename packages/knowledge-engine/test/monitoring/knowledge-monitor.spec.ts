import { describe, expect, it } from "vitest";

import { KnowledgeMetrics } from "../../src/metrics/knowledge-metrics.js";
import { KnowledgeMonitor } from "../../src/monitoring/knowledge-monitor.js";
import { KnowledgeRegistry } from "../../src/registry/knowledge-registry.js";
import { KnowledgeRepository } from "../../src/repository/knowledge-repository.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Monitoring Test — KnowledgeMonitor", () => {
  it("sample() combines Metrics + Health into one Dashboard with all 7 sections", () => {
    const repository = new KnowledgeRepository();
    repository.save(assetFixture());
    const registry = new KnowledgeRegistry();
    const metrics = new KnowledgeMetrics();
    metrics.recordAssetCreated(true);
    metrics.recordWorkspaceCreated();
    metrics.recordPolicyRegistered();
    metrics.recordRelationshipCreated();
    metrics.recordVersionCreated();
    metrics.recordTenantUsage("tenant-1");

    const monitor = new KnowledgeMonitor(metrics, repository, registry);
    const dashboard = monitor.sample();

    expect(dashboard.knowledge).toEqual({ count: 1, documentCount: 1 });
    expect(dashboard.workspace).toEqual({ count: 1 });
    expect(dashboard.policy).toEqual({ count: 1 });
    expect(dashboard.relationship).toEqual({ count: 1 });
    expect(dashboard.version).toEqual({ count: 1 });
    expect(dashboard.tenant.usage).toEqual({ "tenant-1": 1 });
    expect(dashboard.validation.errors).toBe(0);
    expect(dashboard.sampledAt).toEqual(expect.any(String));
    expect(dashboard.health).toBeDefined();
    expect(dashboard.metrics).toBeDefined();
  });

  it("exposes a shared KnowledgeHealth instance via the health property", () => {
    const monitor = new KnowledgeMonitor(
      new KnowledgeMetrics(),
      new KnowledgeRepository(),
      new KnowledgeRegistry(),
    );
    expect(monitor.health.check().status).toBe("unknown");
  });
});
