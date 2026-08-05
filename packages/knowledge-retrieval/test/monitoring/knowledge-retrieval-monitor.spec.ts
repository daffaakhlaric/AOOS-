import { describe, expect, it } from "vitest";

import { KnowledgeRetrievalMetrics } from "../../src/metrics/knowledge-retrieval-metrics.js";
import { KnowledgeRetrievalMonitor } from "../../src/monitoring/knowledge-retrieval-monitor.js";
import { KnowledgeRetrievalRegistry } from "../../src/registry/knowledge-retrieval-registry.js";

describe("KnowledgeRetrievalMonitor", () => {
  it("samples a dashboard combining metrics + health", () => {
    const metrics = new KnowledgeRetrievalMetrics();
    metrics.recordQueryStarted();
    metrics.recordQueryCompleted(5);
    metrics.recordWorkspaceUsage("workspace-1");
    metrics.recordTenantUsage("tenant-1");
    const monitor = new KnowledgeRetrievalMonitor(metrics, new KnowledgeRetrievalRegistry());
    const dashboard = monitor.sample();
    expect(dashboard.search).toEqual({ total: 1, successful: 1, failed: 0 });
    expect(dashboard.latency.averageMs).toBe(5);
    expect(dashboard.workspace.usage).toEqual({ "workspace-1": 1 });
    expect(dashboard.usage.tenantUsage).toEqual({ "tenant-1": 1 });
    expect(dashboard.health).toBeDefined();
    expect(dashboard.metrics).toBeDefined();
    expect(dashboard.sampledAt.length).toBeGreaterThan(0);
  });

  it("exposes ranking/permission/policy sections", () => {
    const metrics = new KnowledgeRetrievalMetrics();
    metrics.recordRankingTime(8);
    metrics.recordPermissionReject(2);
    metrics.recordPolicyReject(1);
    const monitor = new KnowledgeRetrievalMonitor(metrics, new KnowledgeRetrievalRegistry());
    const dashboard = monitor.sample();
    expect(dashboard.ranking.averageMs).toBe(8);
    expect(dashboard.permission.rejectCount).toBe(2);
    expect(dashboard.policy.rejectCount).toBe(1);
  });

  it("exposes .health for direct health checks", () => {
    const metrics = new KnowledgeRetrievalMetrics();
    const monitor = new KnowledgeRetrievalMonitor(metrics, new KnowledgeRetrievalRegistry());
    expect(monitor.health.check().status).toBeDefined();
  });
});
