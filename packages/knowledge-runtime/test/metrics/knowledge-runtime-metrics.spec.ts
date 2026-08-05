import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeState } from "../../src/domain/knowledge-runtime-state.js";
import { KnowledgeRuntimeMetrics } from "../../src/metrics/knowledge-runtime-metrics.js";

describe("Metrics Test — KnowledgeRuntimeMetrics", () => {
  it("starts every counter at zero", () => {
    const metrics = new KnowledgeRuntimeMetrics();
    const snapshot = metrics.snapshot();
    expect(snapshot.runtimeCount).toBe(0);
    expect(snapshot.activeRuntimeCount).toBe(0);
    expect(snapshot.failedRuntimeCount).toBe(0);
    expect(snapshot.suspendedRuntimeCount).toBe(0);
    expect(snapshot.validationFailures).toBe(0);
    expect(snapshot.averageExecutionTimeMs).toBe(0);
    expect(snapshot.averageLoadTimeMs).toBe(0);
    expect(snapshot.tenantUsage).toEqual({});
    expect(snapshot.workspaceUsage).toEqual({});
  });

  it("recordInstanceCreated()/recordInstanceCompleted() maintain runtimeCount/activeRuntimeCount/averageExecutionTimeMs", () => {
    const metrics = new KnowledgeRuntimeMetrics();
    metrics.recordInstanceCreated();
    metrics.recordInstanceCreated();
    metrics.recordInstanceCompleted(100);
    const snapshot = metrics.snapshot();
    expect(snapshot.runtimeCount).toBe(2);
    expect(snapshot.activeRuntimeCount).toBe(1);
    expect(snapshot.averageExecutionTimeMs).toBe(100);
  });

  it("recordInstanceFailed() decrements activeRuntimeCount and increments failedRuntimeCount", () => {
    const metrics = new KnowledgeRuntimeMetrics();
    metrics.recordInstanceCreated();
    metrics.recordInstanceFailed();
    const snapshot = metrics.snapshot();
    expect(snapshot.failedRuntimeCount).toBe(1);
    expect(snapshot.activeRuntimeCount).toBe(0);
  });

  it("recordInstanceSuspended()/recordInstanceResumed() maintain suspendedRuntimeCount", () => {
    const metrics = new KnowledgeRuntimeMetrics();
    metrics.recordInstanceSuspended();
    metrics.recordInstanceSuspended();
    metrics.recordInstanceResumed();
    expect(metrics.snapshot().suspendedRuntimeCount).toBe(1);
  });

  it("recordLoadTime() tracks averageLoadTimeMs", () => {
    const metrics = new KnowledgeRuntimeMetrics();
    metrics.recordLoadTime(10);
    metrics.recordLoadTime(30);
    expect(metrics.snapshot().averageLoadTimeMs).toBe(20);
  });

  it("recordValidationFailure() tracks validationFailures", () => {
    const metrics = new KnowledgeRuntimeMetrics();
    metrics.recordValidationFailure();
    metrics.recordValidationFailure();
    expect(metrics.snapshot().validationFailures).toBe(2);
  });

  it("recordTenantUsage()/recordWorkspaceUsage() track per-id call counts", () => {
    const metrics = new KnowledgeRuntimeMetrics();
    metrics.recordTenantUsage("tenant-1");
    metrics.recordTenantUsage("tenant-1");
    metrics.recordWorkspaceUsage("ws-1");
    const snapshot = metrics.snapshot();
    expect(snapshot.tenantUsage).toEqual({ "tenant-1": 2 });
    expect(snapshot.workspaceUsage).toEqual({ "ws-1": 1 });
  });

  it("recordStateChange() maintains the lifecycleStatistics gauge", () => {
    const metrics = new KnowledgeRuntimeMetrics();
    metrics.recordStateChange(KnowledgeRuntimeState.CREATED);
    metrics.recordStateChange(KnowledgeRuntimeState.LOADING, KnowledgeRuntimeState.CREATED);
    const snapshot = metrics.snapshot();
    expect(snapshot.lifecycleStatistics[KnowledgeRuntimeState.CREATED]).toBe(0);
    expect(snapshot.lifecycleStatistics[KnowledgeRuntimeState.LOADING]).toBe(1);
  });
});
