import { describe, expect, it } from "vitest";

import { WorkflowRuntimeMetricsCollector } from "../../src/metrics/workflow-runtime-metrics-collector.js";
import { WorkflowRuntimeMonitor } from "../../src/monitoring/workflow-runtime-monitor.js";

describe("Monitoring Test — WorkflowRuntimeMonitor", () => {
  it("sample() combines a Metrics snapshot and a Health report with a timestamp", () => {
    const metrics = new WorkflowRuntimeMetricsCollector();
    metrics.recordInstanceCreated();
    const monitor = new WorkflowRuntimeMonitor(metrics);

    const sample = monitor.sample();

    expect(sample.metrics.runningWorkflows).toBe(1);
    expect(sample.health.status).toBe("healthy");
    expect(new Date(sample.sampledAt).toString()).not.toBe("Invalid Date");
  });

  it("exposes the same WorkflowRuntimeHealth instance across samples", () => {
    const monitor = new WorkflowRuntimeMonitor(new WorkflowRuntimeMetricsCollector());
    monitor.health.recordError("validator", "schema drift");
    expect(monitor.sample().health.validator.status).toBe("unhealthy");
  });
});
