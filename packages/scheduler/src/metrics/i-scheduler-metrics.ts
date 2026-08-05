export interface SchedulerMetricsSnapshot {
  readonly jobsCreated: number;
  readonly jobsRunning: number;
  readonly jobsSucceeded: number;
  readonly jobsFailed: number;
  readonly retryCount: number;
  readonly avgExecutionDelayMs: number;
  readonly avgScheduleDriftMs: number;
  readonly queueDepth: number;
  readonly avgSchedulerLatencyMs: number;
}

/** Port for Scheduler Metrics (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md — "METRICS"). */
export interface ISchedulerMetrics {
  recordJobCreated(): void;
  recordJobRunning(): void;
  recordJobSucceeded(): void;
  recordJobFailed(): void;
  recordRetry(): void;
  /** Milliseconds between a Job's planned `nextFireAt` and when it actually became Ready. */
  recordExecutionDelay(ms: number): void;
  /** Milliseconds between a recurring Schedule's ideal cadence and its actual computed next fire time — cumulative timing error. */
  recordScheduleDrift(ms: number): void;
  setQueueDepth(depth: number): void;
  recordSchedulerLatency(ms: number): void;
  snapshot(): SchedulerMetricsSnapshot;
}
