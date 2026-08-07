/** One immutable entry in a Assessment's transition history, appended by the State Machine. */
export interface KnowledgeQualityAssessmentHistoryEntry {
  readonly id: string;
  readonly sequence: number;
  readonly assessmentId: string;
  readonly operation: string;
  readonly fromState?: string;
  readonly toState?: string;
  readonly reason?: string;
  readonly occurredAt: string;
}
