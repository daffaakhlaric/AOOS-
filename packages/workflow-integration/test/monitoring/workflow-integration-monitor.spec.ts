import { describe, expect, it } from "vitest";

import { CapabilityAdapter } from "../../src/adapter/capability-adapter.js";
import { WorkflowIntegrationMetrics } from "../../src/metrics/workflow-integration-metrics.js";
import { WorkflowIntegrationMonitor } from "../../src/monitoring/workflow-integration-monitor.js";
import { WorkflowIntegrationRegistry } from "../../src/registry/workflow-integration-registry.js";
import { successfulRuntime } from "../helpers/runtime-fixture.js";

describe("Monitoring Test — WorkflowIntegrationMonitor", () => {
  it("sample() combines a Metrics snapshot and a Health report with sampledAt", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    const metrics = new WorkflowIntegrationMetrics();
    const monitor = new WorkflowIntegrationMonitor(metrics, registry);

    const dashboard = monitor.sample();

    expect(dashboard.metrics.integrations).toBe(0);
    expect(dashboard.health.status).toBe("healthy");
    expect(dashboard.sampledAt).toEqual(expect.any(String));
  });

  it("computes errorRate/retryRate/averageLatencyMs from the Metrics snapshot", () => {
    const registry = new WorkflowIntegrationRegistry();
    const metrics = new WorkflowIntegrationMetrics();
    metrics.recordIntegrationStarted();
    metrics.recordIntegrationStarted();
    metrics.recordIntegrationCompleted(100);
    metrics.recordIntegrationFailed();
    metrics.recordRetry();
    const monitor = new WorkflowIntegrationMonitor(metrics, registry);

    const dashboard = monitor.sample();

    expect(dashboard.errorRate).toBe(0.5);
    expect(dashboard.retryRate).toBe(0.5);
    expect(dashboard.averageLatencyMs).toBe(100);
  });

  it("returns errorRate/retryRate of 0 with no activity", () => {
    const monitor = new WorkflowIntegrationMonitor(
      new WorkflowIntegrationMetrics(),
      new WorkflowIntegrationRegistry(),
    );
    const dashboard = monitor.sample();
    expect(dashboard.errorRate).toBe(0);
    expect(dashboard.retryRate).toBe(0);
  });

  it("exposes a shared WorkflowIntegrationHealth instance via the health property", () => {
    const registry = new WorkflowIntegrationRegistry();
    const monitor = new WorkflowIntegrationMonitor(new WorkflowIntegrationMetrics(), registry);
    expect(monitor.health.check().status).toBe("unknown");
  });
});
