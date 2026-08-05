import type { IClockProvider } from "../clock/i-clock-provider.js";
import type { SchedulerHealthReport } from "../health/i-health-check.js";
import { SchedulerHealth } from "../health/scheduler-health.js";
import type {
  ISchedulerMetrics,
  SchedulerMetricsSnapshot,
} from "../metrics/i-scheduler-metrics.js";

export interface SchedulerSnapshot {
  readonly metrics: SchedulerMetricsSnapshot;
  readonly health: SchedulerHealthReport;
  readonly sampledAt: string;
}

/** Combines Metrics + Health into one Monitoring sample (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md — "MONITORING"). */
export class SchedulerMonitor {
  private readonly health: SchedulerHealth;

  constructor(
    private readonly metrics: ISchedulerMetrics,
    clock: IClockProvider,
  ) {
    this.health = new SchedulerHealth(() => this.metrics.snapshot(), clock);
  }

  sample(): SchedulerSnapshot {
    return {
      metrics: this.metrics.snapshot(),
      health: this.health.check(),
      sampledAt: new Date().toISOString(),
    };
  }
}
