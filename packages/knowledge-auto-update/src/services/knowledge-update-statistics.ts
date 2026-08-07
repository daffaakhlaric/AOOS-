/**
 * Mutable running counters feeding `KnowledgeUpdateMetrics`. Kept as a service (not a frozen
 * value object) because it accumulates over the engine's lifetime — mirrors the
 * `KnowledgeAnalyticsStatistics` precedent in the `knowledge-analytics` sibling package, despite
 * the spec listing "KnowledgeUpdateStatistics" alongside the value-objects; see README "Design
 * Decisions" for this judgment call.
 */
export class KnowledgeUpdateStatistics {
  private updateCount = 0;
  private successCount = 0;
  private failureCount = 0;
  private retryCount = 0;
  private conflictCount = 0;
  private readonly updateDurationsMs: number[] = [];
  private readonly validationDurationsMs: number[] = [];
  private readonly refreshDurationsMs: number[] = [];

  recordUpdateStarted(): void {
    this.updateCount += 1;
  }

  recordUpdateSucceeded(durationMs: number): void {
    this.successCount += 1;
    this.updateDurationsMs.push(durationMs);
  }

  recordUpdateFailed(): void {
    this.failureCount += 1;
  }

  recordRetry(): void {
    this.retryCount += 1;
  }

  recordConflict(): void {
    this.conflictCount += 1;
  }

  recordValidation(durationMs: number): void {
    this.validationDurationsMs.push(durationMs);
  }

  recordRefresh(durationMs: number): void {
    this.refreshDurationsMs.push(durationMs);
  }

  snapshot(): {
    updateCount: number;
    successCount: number;
    failureCount: number;
    retryCount: number;
    conflictCount: number;
    updateDurationsMs: readonly number[];
    validationDurationsMs: readonly number[];
    refreshDurationsMs: readonly number[];
  } {
    return {
      updateCount: this.updateCount,
      successCount: this.successCount,
      failureCount: this.failureCount,
      retryCount: this.retryCount,
      conflictCount: this.conflictCount,
      updateDurationsMs: [...this.updateDurationsMs],
      validationDurationsMs: [...this.validationDurationsMs],
      refreshDurationsMs: [...this.refreshDurationsMs],
    };
  }
}
