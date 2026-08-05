import { describe, expect, it } from "vitest";

import { InstanceState } from "../../src/instance/instance-state.js";
import { WorkflowRuntimeMetricsCollector } from "../../src/metrics/workflow-runtime-metrics-collector.js";

describe("Metrics Test — WorkflowRuntimeMetricsCollector", () => {
  it("starts with zeroed counters and a full currentStateCount map", () => {
    const metrics = new WorkflowRuntimeMetricsCollector();
    const snapshot = metrics.snapshot();
    expect(snapshot.runningWorkflows).toBe(0);
    expect(snapshot.completedWorkflows).toBe(0);
    expect(snapshot.failedWorkflows).toBe(0);
    expect(snapshot.averageRuntimeMs).toBe(0);
    expect(Object.keys(snapshot.currentStateCount)).toHaveLength(
      Object.values(InstanceState).length,
    );
    expect(snapshot.currentStateCount[InstanceState.RUNNING]).toBe(0);
  });

  it("tracks Running/Completed/Failed Workflow counts", () => {
    const metrics = new WorkflowRuntimeMetricsCollector();
    metrics.recordInstanceCreated();
    metrics.recordInstanceCreated();
    expect(metrics.snapshot().runningWorkflows).toBe(2);

    metrics.recordInstanceCompleted(100);
    expect(metrics.snapshot().runningWorkflows).toBe(1);
    expect(metrics.snapshot().completedWorkflows).toBe(1);

    metrics.recordInstanceFailed();
    expect(metrics.snapshot().runningWorkflows).toBe(0);
    expect(metrics.snapshot().failedWorkflows).toBe(1);
  });

  it("never lets runningWorkflows go negative", () => {
    const metrics = new WorkflowRuntimeMetricsCollector();
    metrics.recordInstanceCompleted(10);
    expect(metrics.snapshot().runningWorkflows).toBe(0);
  });

  it("computes Average Runtime across multiple completions", () => {
    const metrics = new WorkflowRuntimeMetricsCollector();
    metrics.recordInstanceCompleted(100);
    metrics.recordInstanceCompleted(300);
    expect(metrics.snapshot().averageRuntimeMs).toBe(200);
  });

  it("maintains the Current State Count gauge via recordStateChange()", () => {
    const metrics = new WorkflowRuntimeMetricsCollector();
    metrics.recordStateChange(InstanceState.CREATED);
    expect(metrics.snapshot().currentStateCount[InstanceState.CREATED]).toBe(1);
    metrics.recordStateChange(InstanceState.READY, InstanceState.CREATED);
    expect(metrics.snapshot().currentStateCount[InstanceState.CREATED]).toBe(0);
    expect(metrics.snapshot().currentStateCount[InstanceState.READY]).toBe(1);
  });

  it("never lets a state count go negative", () => {
    const metrics = new WorkflowRuntimeMetricsCollector();
    metrics.recordStateChange(InstanceState.READY, InstanceState.CREATED);
    expect(metrics.snapshot().currentStateCount[InstanceState.CREATED]).toBe(0);
  });

  it("tracks average Execution Latency per operation", () => {
    const metrics = new WorkflowRuntimeMetricsCollector();
    metrics.recordExecutionLatency("start", 10);
    metrics.recordExecutionLatency("start", 30);
    metrics.recordExecutionLatency("pause", 5);
    const snapshot = metrics.snapshot();
    expect(snapshot.averageExecutionLatencyMs["start"]).toBe(20);
    expect(snapshot.averageExecutionLatencyMs["pause"]).toBe(5);
  });
});
