import { describe, expect, it } from "vitest";

import { ExecutionMetricsCollector } from "../../src/metrics/execution-metrics-collector.js";

describe("Metrics Test — ExecutionMetricsCollector", () => {
  it("starts every counter at zero", () => {
    const metrics = new ExecutionMetricsCollector();
    expect(metrics.snapshot()).toMatchObject({
      executionCount: 0,
      completedCount: 0,
      failedCount: 0,
      runningCount: 0,
      averageDurationMs: 0,
      retryCount: 0,
      timeoutCount: 0,
      cancellationCount: 0,
    });
  });

  it("tracks started/completed/running counts and average duration", () => {
    const metrics = new ExecutionMetricsCollector();
    metrics.recordExecutionStarted();
    metrics.recordExecutionStarted();
    metrics.recordExecutionCompleted(100);
    metrics.recordExecutionCompleted(300);

    const snapshot = metrics.snapshot();
    expect(snapshot.executionCount).toBe(2);
    expect(snapshot.completedCount).toBe(2);
    expect(snapshot.runningCount).toBe(0);
    expect(snapshot.averageDurationMs).toBe(200);
  });

  it("tracks failed/timeout/cancelled counts and decrements runningCount for each", () => {
    const metrics = new ExecutionMetricsCollector();
    metrics.recordExecutionStarted();
    metrics.recordExecutionStarted();
    metrics.recordExecutionStarted();
    metrics.recordExecutionFailed();
    metrics.recordExecutionTimeout();
    metrics.recordExecutionCancelled();

    const snapshot = metrics.snapshot();
    expect(snapshot.failedCount).toBe(1);
    expect(snapshot.timeoutCount).toBe(1);
    expect(snapshot.cancellationCount).toBe(1);
    expect(snapshot.runningCount).toBe(0);
  });

  it("never lets runningCount go negative", () => {
    const metrics = new ExecutionMetricsCollector();
    metrics.recordExecutionFailed();
    expect(metrics.snapshot().runningCount).toBe(0);
  });

  it("tracks retry counts", () => {
    const metrics = new ExecutionMetricsCollector();
    metrics.recordRetry();
    metrics.recordRetry();
    expect(metrics.snapshot().retryCount).toBe(2);
  });

  it("tracks per-operation average latency independently", () => {
    const metrics = new ExecutionMetricsCollector();
    metrics.recordOperationLatency("start", 10);
    metrics.recordOperationLatency("start", 30);
    metrics.recordOperationLatency("complete", 100);

    const snapshot = metrics.snapshot();
    expect(snapshot.averageOperationLatencyMs["start"]).toBe(20);
    expect(snapshot.averageOperationLatencyMs["complete"]).toBe(100);
  });
});
