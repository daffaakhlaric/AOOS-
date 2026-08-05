import { describe, expect, it } from "vitest";

import { KnowledgeProviderCategory } from "../../src/domain/knowledge-provider-category.js";
import { KnowledgeProviderMetrics } from "../../src/metrics/knowledge-provider-metrics.js";
import { KnowledgeProviderMonitor } from "../../src/monitoring/knowledge-provider-monitor.js";
import { KnowledgeProviderRegistry } from "../../src/registry/knowledge-provider-registry.js";

describe("KnowledgeProviderMonitor", () => {
  it("samples a dashboard combining metrics + health", () => {
    const metrics = new KnowledgeProviderMetrics();
    metrics.recordProviderRegistered("provider-1");
    metrics.recordProviderUsage("provider-1");
    metrics.recordWorkspaceUsage("workspace-1");
    metrics.recordTenantUsage("tenant-1");
    metrics.recordProviderCategory(KnowledgeProviderCategory.DOCUMENT);
    const monitor = new KnowledgeProviderMonitor(metrics, new KnowledgeProviderRegistry());
    const dashboard = monitor.sample();
    expect(dashboard.provider.usage).toEqual({ "provider-1": 1 });
    expect(dashboard.workspace.usage).toEqual({ "workspace-1": 1 });
    expect(dashboard.tenant.usage).toEqual({ "tenant-1": 1 });
    expect(dashboard.category.usage[KnowledgeProviderCategory.DOCUMENT]).toBe(1);
    expect(dashboard.health).toBeDefined();
    expect(dashboard.metrics).toBeDefined();
    expect(dashboard.sampledAt.length).toBeGreaterThan(0);
  });

  it("exposes the usage section with registrationCount/failureCount", () => {
    const metrics = new KnowledgeProviderMetrics();
    metrics.recordProviderRegistered("provider-1");
    metrics.recordFailure();
    const monitor = new KnowledgeProviderMonitor(metrics, new KnowledgeProviderRegistry());
    const dashboard = monitor.sample();
    expect(dashboard.usage).toEqual({ registrationCount: 1, failureCount: 1 });
  });

  it("exposes .health for direct health checks", () => {
    const metrics = new KnowledgeProviderMetrics();
    const monitor = new KnowledgeProviderMonitor(metrics, new KnowledgeProviderRegistry());
    expect(monitor.health.check().status).toBeDefined();
  });
});
