import { describe, expect, it } from "vitest";

import { WorkflowIntegrationMetrics } from "../../src/metrics/workflow-integration-metrics.js";

describe("Metrics Test — WorkflowIntegrationMetrics", () => {
  it("starts every counter at zero", () => {
    const metrics = new WorkflowIntegrationMetrics();
    expect(metrics.snapshot()).toMatchObject({
      integrations: 0,
      completed: 0,
      failures: 0,
      retries: 0,
      timeouts: 0,
      averageResolutionTimeMs: 0,
      averageDurationMs: 0,
      adapterUsage: {},
      tenantUsage: {},
    });
  });

  it("tracks started/completed counts and average duration", () => {
    const metrics = new WorkflowIntegrationMetrics();
    metrics.recordIntegrationStarted();
    metrics.recordIntegrationStarted();
    metrics.recordIntegrationCompleted(100);
    metrics.recordIntegrationCompleted(300);
    const snapshot = metrics.snapshot();
    expect(snapshot.integrations).toBe(2);
    expect(snapshot.completed).toBe(2);
    expect(snapshot.averageDurationMs).toBe(200);
  });

  it("tracks failures/retries/timeouts", () => {
    const metrics = new WorkflowIntegrationMetrics();
    metrics.recordIntegrationFailed();
    metrics.recordRetry();
    metrics.recordRetry();
    metrics.recordTimeout();
    const snapshot = metrics.snapshot();
    expect(snapshot.failures).toBe(1);
    expect(snapshot.retries).toBe(2);
    expect(snapshot.timeouts).toBe(1);
  });

  it("tracks average Resolution Time across samples", () => {
    const metrics = new WorkflowIntegrationMetrics();
    metrics.recordResolutionTime(10);
    metrics.recordResolutionTime(30);
    expect(metrics.snapshot().averageResolutionTimeMs).toBe(20);
  });

  it("tracks Adapter Usage per Adapter name", () => {
    const metrics = new WorkflowIntegrationMetrics();
    metrics.recordAdapterUsage("crm");
    metrics.recordAdapterUsage("crm");
    metrics.recordAdapterUsage("calculator");
    expect(metrics.snapshot().adapterUsage).toEqual({ crm: 2, calculator: 1 });
  });

  it("tracks Tenant Usage per Tenant id", () => {
    const metrics = new WorkflowIntegrationMetrics();
    metrics.recordTenantUsage("tenant-1");
    metrics.recordTenantUsage("tenant-1");
    metrics.recordTenantUsage("tenant-2");
    expect(metrics.snapshot().tenantUsage).toEqual({ "tenant-1": 2, "tenant-2": 1 });
  });
});
