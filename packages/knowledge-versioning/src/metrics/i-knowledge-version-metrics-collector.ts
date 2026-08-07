/**
 * "METRICS: Version Count, Snapshot Count, Branch Count, Rollback Count, Merge Count,
 * Comparison Count, Archive Count, Publish Count, Validation Count."
 * (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md) — the exact 9-field list from the prompt.
 */
export interface KnowledgeVersionMetricsSnapshot {
  readonly versionCount: number;
  readonly snapshotCount: number;
  readonly branchCount: number;
  readonly rollbackCount: number;
  readonly mergeCount: number;
  readonly comparisonCount: number;
  readonly archiveCount: number;
  readonly publishCount: number;
  readonly validationCount: number;
  readonly validationFailureCount: number;
}

/**
 * Named `...Collector` to avoid colliding with a future external metrics sink Extension
 * Point — this is the internal collector `KnowledgeVersionMetrics` implements and the
 * `KnowledgeVersionPipeline` writes through.
 */
export interface IKnowledgeVersionMetricsCollector {
  recordVersion(): void;
  recordSnapshot(): void;
  recordBranch(): void;
  recordRollback(): void;
  recordMerge(): void;
  recordComparison(): void;
  recordArchive(): void;
  recordPublish(): void;
  recordValidation(success: boolean): void;
  snapshot(): KnowledgeVersionMetricsSnapshot;
}
