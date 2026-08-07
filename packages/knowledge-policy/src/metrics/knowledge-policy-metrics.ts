import type {
  IKnowledgePolicyMetricsCollector,
  KnowledgePolicyMetricsSnapshot,
} from "./i-knowledge-policy-metrics-collector.js";

/**
 * "KnowledgePolicyMetrics" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Public API") —
 * a live in-memory snapshot of the 7 named counters.
 */
export class KnowledgePolicyMetrics implements IKnowledgePolicyMetricsCollector {
  private policyCount = 0;
  private activePolicyCount = 0;
  private assignmentCount = 0;
  private evaluationCount = 0;
  private validationCount = 0;
  private archiveCount = 0;
  private restoreCount = 0;
  private validationFailureCount = 0;

  recordPolicy(): void {
    this.policyCount += 1;
  }

  recordActivePolicy(): void {
    this.activePolicyCount += 1;
  }

  recordAssignment(): void {
    this.assignmentCount += 1;
  }

  recordEvaluation(): void {
    this.evaluationCount += 1;
  }

  recordValidation(success: boolean): void {
    this.validationCount += 1;
    if (!success) {
      this.validationFailureCount += 1;
    }
  }

  recordArchive(): void {
    this.archiveCount += 1;
  }

  recordRestore(): void {
    this.restoreCount += 1;
  }

  snapshot(): KnowledgePolicyMetricsSnapshot {
    return {
      policyCount: this.policyCount,
      activePolicyCount: this.activePolicyCount,
      assignmentCount: this.assignmentCount,
      evaluationCount: this.evaluationCount,
      validationCount: this.validationCount,
      archiveCount: this.archiveCount,
      restoreCount: this.restoreCount,
      validationFailureCount: this.validationFailureCount,
    };
  }
}
