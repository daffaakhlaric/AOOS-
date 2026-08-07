import type {
  IKnowledgeVersionMetricsCollector,
  KnowledgeVersionMetricsSnapshot,
} from "./i-knowledge-version-metrics-collector.js";

/**
 * "KnowledgeVersionMetrics" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Public API") —
 * a live in-memory snapshot of the 9 named counters, incremented by `KnowledgeVersioning`/
 * `KnowledgeVersionPipeline` whenever the corresponding Version Operation completes.
 */
export class KnowledgeVersionMetrics implements IKnowledgeVersionMetricsCollector {
  private versionCount = 0;
  private snapshotCount = 0;
  private branchCount = 0;
  private rollbackCount = 0;
  private mergeCount = 0;
  private comparisonCount = 0;
  private archiveCount = 0;
  private publishCount = 0;
  private validationCount = 0;
  private validationFailureCount = 0;

  recordVersion(): void {
    this.versionCount += 1;
  }

  recordSnapshot(): void {
    this.snapshotCount += 1;
  }

  recordBranch(): void {
    this.branchCount += 1;
  }

  recordRollback(): void {
    this.rollbackCount += 1;
  }

  recordMerge(): void {
    this.mergeCount += 1;
  }

  recordComparison(): void {
    this.comparisonCount += 1;
  }

  recordArchive(): void {
    this.archiveCount += 1;
  }

  recordPublish(): void {
    this.publishCount += 1;
  }

  recordValidation(success: boolean): void {
    this.validationCount += 1;
    if (!success) {
      this.validationFailureCount += 1;
    }
  }

  snapshot(): KnowledgeVersionMetricsSnapshot {
    return {
      versionCount: this.versionCount,
      snapshotCount: this.snapshotCount,
      branchCount: this.branchCount,
      rollbackCount: this.rollbackCount,
      mergeCount: this.mergeCount,
      comparisonCount: this.comparisonCount,
      archiveCount: this.archiveCount,
      publishCount: this.publishCount,
      validationCount: this.validationCount,
      validationFailureCount: this.validationFailureCount,
    };
  }
}
