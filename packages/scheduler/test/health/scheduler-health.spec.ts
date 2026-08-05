import { describe, expect, it } from "vitest";

import { MockClock } from "../../src/clock/mock-clock.js";
import { SchedulerHealth } from "../../src/health/scheduler-health.js";
import type { SchedulerMetricsSnapshot } from "../../src/metrics/i-scheduler-metrics.js";

function metrics(overrides: Partial<SchedulerMetricsSnapshot> = {}): SchedulerMetricsSnapshot {
  return {
    jobsCreated: 0,
    jobsRunning: 0,
    jobsSucceeded: 0,
    jobsFailed: 0,
    retryCount: 0,
    avgExecutionDelayMs: 0,
    avgScheduleDriftMs: 0,
    queueDepth: 0,
    avgSchedulerLatencyMs: 0,
    ...overrides,
  };
}

describe("Health Test — SchedulerHealth", () => {
  it("reports Healthy across every component when metrics are clean", () => {
    const health = new SchedulerHealth(
      () => metrics({ jobsSucceeded: 10 }),
      new MockClock("2026-01-01T00:00:00.000Z"),
    );
    const report = health.check();
    expect(report.status).toBe("healthy");
    expect(report.scheduler.status).toBe("healthy");
    expect(report.clock.status).toBe("healthy");
    expect(report.queue.status).toBe("healthy");
    expect(report.trigger.status).toBe("healthy");
    expect(report.dispatcher.status).toBe("healthy");
  });

  it("degrades Dispatcher health when the failure ratio crosses 10%", () => {
    const health = new SchedulerHealth(
      () => metrics({ jobsSucceeded: 8, jobsFailed: 2 }),
      new MockClock(),
    );
    expect(health.check().dispatcher.status).toBe("degraded");
  });

  it("marks Dispatcher unhealthy when the failure ratio crosses 50%", () => {
    const health = new SchedulerHealth(
      () => metrics({ jobsSucceeded: 4, jobsFailed: 6 }),
      new MockClock(),
    );
    expect(health.check().dispatcher.status).toBe("unhealthy");
  });

  it("does not divide by zero when there are no outcomes yet", () => {
    const health = new SchedulerHealth(() => metrics(), new MockClock());
    expect(health.check().dispatcher.status).toBe("healthy");
  });

  it("degrades Queue health when queueDepth exceeds the threshold", () => {
    const health = new SchedulerHealth(() => metrics({ queueDepth: 20_000 }), new MockClock());
    expect(health.check().queue.status).toBe("degraded");
  });

  it("marks Clock unhealthy when it returns an invalid Date", () => {
    const health = new SchedulerHealth(() => metrics(), new MockClock("not-a-real-date"));
    expect(health.check().clock.status).toBe("unhealthy");
  });

  it("Scheduler status is the worst of its components", () => {
    const health = new SchedulerHealth(
      () => metrics({ jobsSucceeded: 4, jobsFailed: 6 }),
      new MockClock(),
    );
    const report = health.check();
    expect(report.status).toBe("unhealthy");
    expect(report.scheduler.status).toBe("unhealthy");
  });
});
