import { describe, expect, it } from "vitest";

import { MockClock } from "../../src/clock/mock-clock.js";
import { SchedulerMetricsCollector } from "../../src/metrics/scheduler-metrics-collector.js";
import { SchedulerMonitor } from "../../src/monitoring/scheduler-monitor.js";

describe("SchedulerMonitor", () => {
  it("combines a Metrics snapshot and a Health check into one sample", () => {
    const metrics = new SchedulerMetricsCollector();
    metrics.recordJobCreated();
    const monitor = new SchedulerMonitor(metrics, new MockClock("2026-01-01T00:00:00.000Z"));

    const sample = monitor.sample();
    expect(sample.metrics.jobsCreated).toBe(1);
    expect(sample.health.status).toBe("healthy");
    expect(typeof sample.sampledAt).toBe("string");
  });
});
