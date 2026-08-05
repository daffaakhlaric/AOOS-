import type { ISchedulerMetrics, SchedulerMetricsSnapshot } from "./i-scheduler-metrics.js";

/** Collects the Scheduler Metrics enumerated in docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md. */
export class SchedulerMetricsCollector implements ISchedulerMetrics {
  private jobsCreated = 0;
  private jobsRunning = 0;
  private jobsSucceeded = 0;
  private jobsFailed = 0;
  private retryCount = 0;
  private executionDelayMsTotal = 0;
  private executionDelaySamples = 0;
  private scheduleDriftMsTotal = 0;
  private scheduleDriftSamples = 0;
  private queueDepth = 0;
  private schedulerLatencyMsTotal = 0;
  private schedulerLatencySamples = 0;

  recordJobCreated(): void {
    this.jobsCreated += 1;
  }

  recordJobRunning(): void {
    this.jobsRunning += 1;
  }

  recordJobSucceeded(): void {
    this.jobsSucceeded += 1;
  }

  recordJobFailed(): void {
    this.jobsFailed += 1;
  }

  recordRetry(): void {
    this.retryCount += 1;
  }

  recordExecutionDelay(ms: number): void {
    this.executionDelayMsTotal += ms;
    this.executionDelaySamples += 1;
  }

  recordScheduleDrift(ms: number): void {
    this.scheduleDriftMsTotal += ms;
    this.scheduleDriftSamples += 1;
  }

  setQueueDepth(depth: number): void {
    this.queueDepth = depth;
  }

  recordSchedulerLatency(ms: number): void {
    this.schedulerLatencyMsTotal += ms;
    this.schedulerLatencySamples += 1;
  }

  snapshot(): SchedulerMetricsSnapshot {
    return {
      jobsCreated: this.jobsCreated,
      jobsRunning: this.jobsRunning,
      jobsSucceeded: this.jobsSucceeded,
      jobsFailed: this.jobsFailed,
      retryCount: this.retryCount,
      avgExecutionDelayMs:
        this.executionDelaySamples === 0
          ? 0
          : this.executionDelayMsTotal / this.executionDelaySamples,
      avgScheduleDriftMs:
        this.scheduleDriftSamples === 0 ? 0 : this.scheduleDriftMsTotal / this.scheduleDriftSamples,
      queueDepth: this.queueDepth,
      avgSchedulerLatencyMs:
        this.schedulerLatencySamples === 0
          ? 0
          : this.schedulerLatencyMsTotal / this.schedulerLatencySamples,
    };
  }
}
