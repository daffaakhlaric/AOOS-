import { describe, expect, it } from "vitest";

import { WorkflowRuntimeHealth } from "../../src/health/workflow-runtime-health.js";
import { WorkflowRuntimeMetricsCollector } from "../../src/metrics/workflow-runtime-metrics-collector.js";

describe("Health Test — WorkflowRuntimeHealth", () => {
  it("reports healthy across every component when nothing has failed and no workflows have finished", () => {
    const metrics = new WorkflowRuntimeMetricsCollector();
    const health = new WorkflowRuntimeHealth(() => metrics.snapshot());
    const report = health.check();
    expect(report.status).toBe("healthy");
    expect(report.runtime.status).toBe("healthy");
    expect(report.loader.status).toBe("healthy");
    expect(report.validator.status).toBe("healthy");
    expect(report.stateMachine.status).toBe("healthy");
    expect(report.context.status).toBe("healthy");
  });

  it("derives degraded/unhealthy runtime status from the Metrics failure ratio", () => {
    const metrics = new WorkflowRuntimeMetricsCollector();
    const health = new WorkflowRuntimeHealth(() => metrics.snapshot());

    for (let i = 0; i < 8; i += 1) metrics.recordInstanceCompleted(1);
    for (let i = 0; i < 2; i += 1) metrics.recordInstanceFailed();
    expect(health.check().runtime.status).toBe("degraded");

    for (let i = 0; i < 10; i += 1) metrics.recordInstanceFailed();
    expect(health.check().runtime.status).toBe("unhealthy");
  });

  it("recordError()/clearError() drive a component's health status", () => {
    const metrics = new WorkflowRuntimeMetricsCollector();
    const health = new WorkflowRuntimeHealth(() => metrics.snapshot());

    health.recordError("loader", "registry unreachable");
    const degraded = health.check();
    expect(degraded.loader.status).toBe("unhealthy");
    expect(degraded.status).toBe("unhealthy");
    expect(degraded.loader.details).toMatchObject({ error: "registry unreachable" });

    health.clearError("loader");
    expect(health.check().loader.status).toBe("healthy");
  });
});
