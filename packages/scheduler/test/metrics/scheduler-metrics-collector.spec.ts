import { describe, expect, it } from "vitest";

import { SchedulerMetricsCollector } from "../../src/metrics/scheduler-metrics-collector.js";

describe("Metrics Test — SchedulerMetricsCollector", () => {
  it("starts at all zeros", () => {
    const metrics = new SchedulerMetricsCollector();
    expect(metrics.snapshot()).toEqual({
      jobsCreated: 0,
      jobsRunning: 0,
      jobsSucceeded: 0,
      jobsFailed: 0,
      retryCount: 0,
      avgExecutionDelayMs: 0,
      avgScheduleDriftMs: 0,
      queueDepth: 0,
      avgSchedulerLatencyMs: 0,
    });
  });

  it("counts Job Created/Running/Success/Failed/Retry independently", () => {
    const metrics = new SchedulerMetricsCollector();
    metrics.recordJobCreated();
    metrics.recordJobCreated();
    metrics.recordJobRunning();
    metrics.recordJobSucceeded();
    metrics.recordJobFailed();
    metrics.recordRetry();

    const snapshot = metrics.snapshot();
    expect(snapshot.jobsCreated).toBe(2);
    expect(snapshot.jobsRunning).toBe(1);
    expect(snapshot.jobsSucceeded).toBe(1);
    expect(snapshot.jobsFailed).toBe(1);
    expect(snapshot.retryCount).toBe(1);
  });

  it("computes Execution Delay as the average of every recorded sample", () => {
    const metrics = new SchedulerMetricsCollector();
    metrics.recordExecutionDelay(100);
    metrics.recordExecutionDelay(300);
    expect(metrics.snapshot().avgExecutionDelayMs).toBe(200);
  });

  it("computes Schedule Drift as the average of every recorded sample", () => {
    const metrics = new SchedulerMetricsCollector();
    metrics.recordScheduleDrift(10);
    metrics.recordScheduleDrift(30);
    expect(metrics.snapshot().avgScheduleDriftMs).toBe(20);
  });

  it("computes Scheduler Latency as the average of every recorded sample", () => {
    const metrics = new SchedulerMetricsCollector();
    metrics.recordSchedulerLatency(5);
    metrics.recordSchedulerLatency(15);
    expect(metrics.snapshot().avgSchedulerLatencyMs).toBe(10);
  });

  it("tracks Queue Depth as the latest set value", () => {
    const metrics = new SchedulerMetricsCollector();
    metrics.setQueueDepth(5);
    metrics.setQueueDepth(2);
    expect(metrics.snapshot().queueDepth).toBe(2);
  });
});
