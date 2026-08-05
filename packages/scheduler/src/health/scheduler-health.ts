import type { IClockProvider } from "../clock/i-clock-provider.js";
import type { SchedulerMetricsSnapshot } from "../metrics/i-scheduler-metrics.js";

import type { ComponentHealth, HealthStatus, SchedulerHealthReport } from "./i-health-check.js";

const STATUS_RANK: Readonly<Record<HealthStatus, number>> = {
  healthy: 0,
  degraded: 1,
  unhealthy: 2,
};

function worstOf(statuses: readonly HealthStatus[]): HealthStatus {
  return statuses.reduce((worst, status) =>
    STATUS_RANK[status] > STATUS_RANK[worst] ? status : worst,
  );
}

function ratioStatus(ratio: number, degradedAt: number, unhealthyAt: number): HealthStatus {
  if (ratio >= unhealthyAt) {
    return "unhealthy";
  }
  if (ratio >= degradedAt) {
    return "degraded";
  }
  return "healthy";
}

const QUEUE_DEPTH_DEGRADED_AT = 10_000;

/** Derives Scheduler/Clock/Queue/Trigger/Dispatcher Health from a live Metrics snapshot + the Clock itself. */
export class SchedulerHealth {
  constructor(
    private readonly getMetrics: () => SchedulerMetricsSnapshot,
    private readonly clock: IClockProvider,
  ) {}

  check(): SchedulerHealthReport {
    const metrics = this.getMetrics();

    const clockHealthy = !Number.isNaN(this.clock.now().getTime());
    const clock: ComponentHealth = { status: clockHealthy ? "healthy" : "unhealthy" };

    const totalOutcomes = metrics.jobsSucceeded + metrics.jobsFailed;
    const failureRatio = totalOutcomes === 0 ? 0 : metrics.jobsFailed / totalOutcomes;
    const dispatcher: ComponentHealth = {
      status: ratioStatus(failureRatio, 0.1, 0.5),
      details: { jobsSucceeded: metrics.jobsSucceeded, jobsFailed: metrics.jobsFailed },
    };

    const queue: ComponentHealth = {
      status: metrics.queueDepth > QUEUE_DEPTH_DEGRADED_AT ? "degraded" : "healthy",
      details: { queueDepth: metrics.queueDepth },
    };

    // Trigger detection is stateless (pure time/state comparisons) — it degrades only if the
    // components that depend on it (dispatcher/queue) are already unhealthy, never independently.
    const trigger: ComponentHealth = { status: "healthy" };

    const status = worstOf([clock.status, dispatcher.status, queue.status, trigger.status]);
    const scheduler: ComponentHealth = { status };

    return { status, scheduler, clock, queue, trigger, dispatcher };
  }
}
