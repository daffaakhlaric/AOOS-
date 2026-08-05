import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationMetrics } from "../../src/metrics/knowledge-synchronization-metrics.js";
import { KnowledgeSynchronizationMonitor } from "../../src/monitoring/knowledge-synchronization-monitor.js";
import { KnowledgeSynchronizationRegistry } from "../../src/registry/knowledge-synchronization-registry.js";

describe("KnowledgeSynchronizationMonitor", () => {
  it("samples a dashboard combining metrics + health", () => {
    const metrics = new KnowledgeSynchronizationMetrics();
    metrics.recordSynchronizationStarted();
    metrics.recordSynchronizationCompleted(5);
    metrics.recordProviderUsage("provider-1");
    metrics.recordWorkspaceUsage("workspace-1");
    metrics.recordTenantUsage("tenant-1");
    const monitor = new KnowledgeSynchronizationMonitor(
      metrics,
      new KnowledgeSynchronizationRegistry(),
    );
    const dashboard = monitor.sample();
    expect(dashboard.synchronization).toEqual({ total: 1, successful: 1, failed: 0 });
    expect(dashboard.performance.averageDurationMs).toBe(5);
    expect(dashboard.provider.usage).toEqual({ "provider-1": 1 });
    expect(dashboard.workspace.usage).toEqual({ "workspace-1": 1 });
    expect(dashboard.tenant.usage).toEqual({ "tenant-1": 1 });
    expect(dashboard.health).toBeDefined();
    expect(dashboard.metrics).toBeDefined();
    expect(dashboard.sampledAt.length).toBeGreaterThan(0);
  });

  it("exposes queue/failure/retry sections", () => {
    const metrics = new KnowledgeSynchronizationMetrics();
    metrics.setQueueLength(3);
    metrics.setPendingJobs(2);
    metrics.recordRetry();
    const monitor = new KnowledgeSynchronizationMonitor(
      metrics,
      new KnowledgeSynchronizationRegistry(),
    );
    const dashboard = monitor.sample();
    expect(dashboard.queue).toEqual({ length: 3, pendingJobs: 2 });
    expect(dashboard.retry.retryCount).toBe(1);
  });

  it("exposes .health for direct health checks", () => {
    const metrics = new KnowledgeSynchronizationMetrics();
    const monitor = new KnowledgeSynchronizationMonitor(
      metrics,
      new KnowledgeSynchronizationRegistry(),
    );
    expect(monitor.health.check().status).toBeDefined();
  });
});
