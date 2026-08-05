import type { ExecutionMetricsSnapshot, IExecutionMetrics } from "./i-execution-metrics.js";

interface LatencySample {
  totalMs: number;
  samples: number;
}

export class ExecutionMetricsCollector implements IExecutionMetrics {
  private executionCount = 0;
  private completedCount = 0;
  private failedCount = 0;
  private runningCount = 0;
  private timeoutCount = 0;
  private cancellationCount = 0;
  private retryCount = 0;
  private totalDurationMs = 0;
  private completedSamples = 0;
  private readonly latencyByOperation = new Map<string, LatencySample>();

  recordExecutionStarted(): void {
    this.executionCount += 1;
    this.runningCount += 1;
  }

  recordExecutionCompleted(durationMs: number): void {
    this.completedCount += 1;
    this.totalDurationMs += durationMs;
    this.completedSamples += 1;
    this.runningCount = Math.max(0, this.runningCount - 1);
  }

  recordExecutionFailed(): void {
    this.failedCount += 1;
    this.runningCount = Math.max(0, this.runningCount - 1);
  }

  recordExecutionTimeout(): void {
    this.timeoutCount += 1;
    this.runningCount = Math.max(0, this.runningCount - 1);
  }

  recordExecutionCancelled(): void {
    this.cancellationCount += 1;
    this.runningCount = Math.max(0, this.runningCount - 1);
  }

  recordRetry(): void {
    this.retryCount += 1;
  }

  recordOperationLatency(operation: string, ms: number): void {
    const existing = this.latencyByOperation.get(operation) ?? { totalMs: 0, samples: 0 };
    this.latencyByOperation.set(operation, {
      totalMs: existing.totalMs + ms,
      samples: existing.samples + 1,
    });
  }

  snapshot(): ExecutionMetricsSnapshot {
    const averageOperationLatencyMs: Record<string, number> = {};
    for (const [operation, sample] of this.latencyByOperation) {
      averageOperationLatencyMs[operation] =
        sample.samples === 0 ? 0 : sample.totalMs / sample.samples;
    }
    return {
      executionCount: this.executionCount,
      completedCount: this.completedCount,
      failedCount: this.failedCount,
      runningCount: this.runningCount,
      averageDurationMs:
        this.completedSamples === 0 ? 0 : this.totalDurationMs / this.completedSamples,
      retryCount: this.retryCount,
      timeoutCount: this.timeoutCount,
      cancellationCount: this.cancellationCount,
      averageOperationLatencyMs,
    };
  }
}
