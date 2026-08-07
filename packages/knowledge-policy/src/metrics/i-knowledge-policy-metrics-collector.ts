/**
 * "METRICS: Policy Count, Active Policy Count, Assignment Count, Evaluation Count,
 * Validation Count, Archive Count, Restore Count." (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md)
 * — the exact 7-field list from the prompt, plus validationFailureCount.
 */
export interface KnowledgePolicyMetricsSnapshot {
  readonly policyCount: number;
  readonly activePolicyCount: number;
  readonly assignmentCount: number;
  readonly evaluationCount: number;
  readonly validationCount: number;
  readonly archiveCount: number;
  readonly restoreCount: number;
  readonly validationFailureCount: number;
}

export interface IKnowledgePolicyMetricsCollector {
  recordPolicy(): void;
  recordActivePolicy(): void;
  recordAssignment(): void;
  recordEvaluation(): void;
  recordValidation(success: boolean): void;
  recordArchive(): void;
  recordRestore(): void;
  snapshot(): KnowledgePolicyMetricsSnapshot;
}
