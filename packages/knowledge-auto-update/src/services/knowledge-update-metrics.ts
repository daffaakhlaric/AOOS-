export interface KnowledgeUpdateMetricsInput {
  readonly updateCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly retryCount: number;
  readonly conflictCount: number;
  readonly updateDurationsMs: readonly number[];
  readonly validationDurationsMs: readonly number[];
  readonly refreshDurationsMs: readonly number[];
  readonly pendingJobs: number;
  readonly completedJobs: number;
  readonly cancelledJobs: number;
  readonly expiredJobs: number;
  readonly queueSize: number;
}

/** The 16 named metrics from the spec, as a flat computed snapshot. */
export interface KnowledgeUpdateMetricsSnapshot {
  readonly updateCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly retryCount: number;
  readonly conflictCount: number;
  readonly averageUpdateTimeMs: number;
  readonly averageValidationTimeMs: number;
  readonly averageRefreshTimeMs: number;
  readonly pendingJobs: number;
  readonly completedJobs: number;
  readonly cancelledJobs: number;
  readonly expiredJobs: number;
  readonly queueSize: number;
  readonly successRate: number;
  readonly failureRate: number;
  readonly retryRate: number;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/** Real computation of the 16 metrics (rates + averages), same correctness bar as sibling packages. */
export class KnowledgeUpdateMetrics {
  compute(input: KnowledgeUpdateMetricsInput): KnowledgeUpdateMetricsSnapshot {
    return {
      updateCount: input.updateCount,
      successCount: input.successCount,
      failureCount: input.failureCount,
      retryCount: input.retryCount,
      conflictCount: input.conflictCount,
      averageUpdateTimeMs: average(input.updateDurationsMs),
      averageValidationTimeMs: average(input.validationDurationsMs),
      averageRefreshTimeMs: average(input.refreshDurationsMs),
      pendingJobs: input.pendingJobs,
      completedJobs: input.completedJobs,
      cancelledJobs: input.cancelledJobs,
      expiredJobs: input.expiredJobs,
      queueSize: input.queueSize,
      successRate: rate(input.successCount, input.updateCount),
      failureRate: rate(input.failureCount, input.updateCount),
      retryRate: rate(input.retryCount, input.updateCount),
    };
  }
}
