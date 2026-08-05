import { describe, expect, it } from "vitest";

import { ExecutionHealth } from "../../src/health/execution-health.js";
import { ExecutionMetricsCollector } from "../../src/metrics/execution-metrics-collector.js";

describe("Health Test — ExecutionHealth", () => {
  it("reports overall status 'healthy' with no activity and no recorded errors", () => {
    const metrics = new ExecutionMetricsCollector();
    const health = new ExecutionHealth(() => metrics.snapshot());
    const report = health.check();
    expect(report.status).toBe("healthy");
    expect(report.runningWorkflow.status).toBe("healthy");
    expect(report.executionQueue.status).toBe("healthy");
  });

  it("derives 'degraded' Running Workflow health from a moderate failure ratio", () => {
    const metrics = new ExecutionMetricsCollector();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordExecutionStarted();
    }
    for (let i = 0; i < 8; i += 1) {
      metrics.recordExecutionCompleted(10);
    }
    for (let i = 0; i < 2; i += 1) {
      metrics.recordExecutionFailed();
    }
    const health = new ExecutionHealth(() => metrics.snapshot());
    expect(health.check().runningWorkflow.status).toBe("degraded");
  });

  it("derives 'unhealthy' Running Workflow health from a majority failure ratio", () => {
    const metrics = new ExecutionMetricsCollector();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordExecutionStarted();
    }
    for (let i = 0; i < 4; i += 1) {
      metrics.recordExecutionCompleted(10);
    }
    for (let i = 0; i < 6; i += 1) {
      metrics.recordExecutionFailed();
    }
    const health = new ExecutionHealth(() => metrics.snapshot());
    expect(health.check().runningWorkflow.status).toBe("unhealthy");
  });

  it("marks a component unhealthy after recordError(), and heals it back after clearError()", () => {
    const metrics = new ExecutionMetricsCollector();
    const health = new ExecutionHealth(() => metrics.snapshot());

    health.recordError("checkpoint", "store unavailable");
    let report = health.check();
    expect(report.checkpoint.status).toBe("unhealthy");
    expect(report.checkpoint.details).toMatchObject({ error: "store unavailable" });
    expect(report.status).toBe("unhealthy");

    health.clearError("checkpoint");
    report = health.check();
    expect(report.checkpoint.status).toBe("healthy");
    expect(report.status).toBe("healthy");
  });

  it("reports the worst status across every component as the overall status", () => {
    const metrics = new ExecutionMetricsCollector();
    const health = new ExecutionHealth(() => metrics.snapshot());
    health.recordError("deadWorkflow", "stuck");
    expect(health.check().status).toBe("unhealthy");
  });

  it("tracks errors independently per component", () => {
    const metrics = new ExecutionMetricsCollector();
    const health = new ExecutionHealth(() => metrics.snapshot());
    health.recordError("executionQueue", "queue backed up");
    const report = health.check();
    expect(report.executionQueue.status).toBe("unhealthy");
    expect(report.waitingWorkflow.status).toBe("healthy");
    expect(report.deadWorkflow.status).toBe("healthy");
  });

  it("clearError() on a component with no recorded error is a no-op", () => {
    const metrics = new ExecutionMetricsCollector();
    const health = new ExecutionHealth(() => metrics.snapshot());
    health.clearError("waitingWorkflow");
    expect(health.check().waitingWorkflow.status).toBe("healthy");
  });
});
