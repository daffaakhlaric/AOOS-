import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/contracts/node-type.js";
import { NodeRuntimeMetricsCollector } from "../../src/metrics/node-runtime-metrics-collector.js";

describe("Metrics Test — NodeRuntimeMetricsCollector", () => {
  it("starts with zeroed counters", () => {
    const metrics = new NodeRuntimeMetricsCollector();
    const snapshot = metrics.snapshot();
    expect(snapshot.nodeCount).toBe(0);
    expect(snapshot.nodeSuccessCount).toBe(0);
    expect(snapshot.nodeFailureCount).toBe(0);
    expect(snapshot.averageNodeRuntimeMs).toBe(0);
    expect(snapshot.countByType).toEqual({});
  });

  it("tracks Node Count broken down by Node Type", () => {
    const metrics = new NodeRuntimeMetricsCollector();
    metrics.recordNodeCreated(NodeType.CAPABILITY);
    metrics.recordNodeCreated(NodeType.CAPABILITY);
    metrics.recordNodeCreated(NodeType.CUSTOM);
    const snapshot = metrics.snapshot();
    expect(snapshot.nodeCount).toBe(3);
    expect(snapshot.countByType[NodeType.CAPABILITY]).toBe(2);
    expect(snapshot.countByType[NodeType.CUSTOM]).toBe(1);
  });

  it("tracks Node Success/Failure counts and Average Node Runtime", () => {
    const metrics = new NodeRuntimeMetricsCollector();
    metrics.recordNodeSuccess(100);
    metrics.recordNodeSuccess(300);
    metrics.recordNodeFailure();
    const snapshot = metrics.snapshot();
    expect(snapshot.nodeSuccessCount).toBe(2);
    expect(snapshot.nodeFailureCount).toBe(1);
    expect(snapshot.averageNodeRuntimeMs).toBe(200);
  });

  it("tracks average Execution Latency per operation", () => {
    const metrics = new NodeRuntimeMetricsCollector();
    metrics.recordExecutionLatency("start", 10);
    metrics.recordExecutionLatency("start", 30);
    metrics.recordExecutionLatency("pause", 5);
    const snapshot = metrics.snapshot();
    expect(snapshot.averageExecutionLatencyMs["start"]).toBe(20);
    expect(snapshot.averageExecutionLatencyMs["pause"]).toBe(5);
  });
});
