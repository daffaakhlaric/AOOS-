export interface ExecutionMetricsSnapshot {
  readonly executionCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly runningCount: number;
  readonly averageDurationMs: number;
  readonly retryCount: number;
  readonly timeoutCount: number;
  readonly cancellationCount: number;
  readonly averageOperationLatencyMs: Readonly<Record<string, number>>;
}

/** "METRICS" (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md): Execution Count, Completed, Failed, Running, Average Duration, Retry Count, Timeout Count, Cancellation Count. */
export interface IExecutionMetrics {
  recordExecutionStarted(): void;
  recordExecutionCompleted(durationMs: number): void;
  recordExecutionFailed(): void;
  recordExecutionTimeout(): void;
  recordExecutionCancelled(): void;
  recordRetry(): void;
  recordOperationLatency(operation: string, ms: number): void;
  snapshot(): ExecutionMetricsSnapshot;
}
