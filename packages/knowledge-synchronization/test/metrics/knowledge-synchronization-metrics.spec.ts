import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationMode } from "../../src/domain/knowledge-synchronization-mode.js";
import { KnowledgeSynchronizationMetrics } from "../../src/metrics/knowledge-synchronization-metrics.js";

describe("KnowledgeSynchronizationMetrics", () => {
  it("starts with a zeroed snapshot", () => {
    const metrics = new KnowledgeSynchronizationMetrics();
    const snapshot = metrics.snapshot();
    expect(snapshot.synchronizationCount).toBe(0);
    expect(snapshot.averageDurationMs).toBe(0);
  });

  it("tracks synchronizationCount/successful/failed", () => {
    const metrics = new KnowledgeSynchronizationMetrics();
    metrics.recordSynchronizationStarted();
    metrics.recordSynchronizationStarted();
    metrics.recordSynchronizationCompleted(10);
    metrics.recordSynchronizationFailed();
    const snapshot = metrics.snapshot();
    expect(snapshot.synchronizationCount).toBe(2);
    expect(snapshot.successfulSynchronizations).toBe(1);
    expect(snapshot.failedSynchronizations).toBe(1);
    expect(snapshot.averageDurationMs).toBe(10);
  });

  it("tracks retry count", () => {
    const metrics = new KnowledgeSynchronizationMetrics();
    metrics.recordRetry();
    metrics.recordRetry();
    expect(metrics.snapshot().retryCount).toBe(2);
  });

  it("tracks queueLength and pendingJobs as gauges", () => {
    const metrics = new KnowledgeSynchronizationMetrics();
    metrics.setQueueLength(5);
    metrics.setPendingJobs(3);
    const snapshot = metrics.snapshot();
    expect(snapshot.queueLength).toBe(5);
    expect(snapshot.pendingJobs).toBe(3);
  });

  it("tracks provider/workspace/tenant usage counts", () => {
    const metrics = new KnowledgeSynchronizationMetrics();
    metrics.recordProviderUsage("provider-1");
    metrics.recordProviderUsage("provider-1");
    metrics.recordWorkspaceUsage("workspace-1");
    metrics.recordTenantUsage("tenant-1");
    const snapshot = metrics.snapshot();
    expect(snapshot.providerStatistics).toEqual({ "provider-1": 2 });
    expect(snapshot.workspaceStatistics).toEqual({ "workspace-1": 1 });
    expect(snapshot.tenantStatistics).toEqual({ "tenant-1": 1 });
  });

  it("tracks synchronization mode statistics for every KnowledgeSynchronizationMode", () => {
    const metrics = new KnowledgeSynchronizationMetrics();
    metrics.recordSynchronizationMode(KnowledgeSynchronizationMode.MANUAL);
    const snapshot = metrics.snapshot();
    expect(snapshot.synchronizationModeStatistics[KnowledgeSynchronizationMode.MANUAL]).toBe(1);
    expect(snapshot.synchronizationModeStatistics[KnowledgeSynchronizationMode.FULL]).toBe(0);
    expect(Object.keys(snapshot.synchronizationModeStatistics)).toHaveLength(7);
  });
});
