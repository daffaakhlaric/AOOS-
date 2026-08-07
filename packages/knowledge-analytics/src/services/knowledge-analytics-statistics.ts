/** An immutable point-in-time read of {@link KnowledgeAnalyticsStatistics}. */
export interface KnowledgeAnalyticsStatisticsSnapshot {
  readonly samplesRecorded: number;
  readonly metricsCalculated: number;
  readonly reportsGenerated: number;
  readonly dashboardSnapshotsGenerated: number;
  readonly pipelineRunsCompleted: number;
  readonly pipelineRunsFailed: number;
  readonly eventsPublished: number;
  readonly capturedAt: number;
}

/**
 * This package's own internal, mutable, operational bookkeeping counters — distinct from the
 * domain `Metrics` the analytics services compute (e.g. Hit Rate, P95 Query Time). This tracks how
 * many times the package itself did things: samples recorded, metrics calculated, reports
 * generated, pipeline runs completed/failed, events published.
 */
export class KnowledgeAnalyticsStatistics {
  private samplesRecorded = 0;
  private metricsCalculated = 0;
  private reportsGenerated = 0;
  private dashboardSnapshotsGenerated = 0;
  private pipelineRunsCompleted = 0;
  private pipelineRunsFailed = 0;
  private eventsPublished = 0;

  recordSampleRecorded(count = 1): void {
    this.samplesRecorded += count;
  }

  recordMetricCalculated(count = 1): void {
    this.metricsCalculated += count;
  }

  recordReportGenerated(count = 1): void {
    this.reportsGenerated += count;
  }

  recordDashboardSnapshotGenerated(count = 1): void {
    this.dashboardSnapshotsGenerated += count;
  }

  recordPipelineRunCompleted(): void {
    this.pipelineRunsCompleted += 1;
  }

  recordPipelineRunFailed(): void {
    this.pipelineRunsFailed += 1;
  }

  recordEventPublished(count = 1): void {
    this.eventsPublished += count;
  }

  snapshot(now: number): KnowledgeAnalyticsStatisticsSnapshot {
    return {
      samplesRecorded: this.samplesRecorded,
      metricsCalculated: this.metricsCalculated,
      reportsGenerated: this.reportsGenerated,
      dashboardSnapshotsGenerated: this.dashboardSnapshotsGenerated,
      pipelineRunsCompleted: this.pipelineRunsCompleted,
      pipelineRunsFailed: this.pipelineRunsFailed,
      eventsPublished: this.eventsPublished,
      capturedAt: now,
    };
  }

  reset(): void {
    this.samplesRecorded = 0;
    this.metricsCalculated = 0;
    this.reportsGenerated = 0;
    this.dashboardSnapshotsGenerated = 0;
    this.pipelineRunsCompleted = 0;
    this.pipelineRunsFailed = 0;
    this.eventsPublished = 0;
  }
}
