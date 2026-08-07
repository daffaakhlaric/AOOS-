/** One immutable entry in a Validation's transition history, appended by the State Machine. */
export interface KnowledgeValidationHistoryEntry {
  readonly id: string;
  readonly sequence: number;
  readonly validationId: string;
  readonly operation: string;
  readonly fromState?: string;
  readonly toState?: string;
  readonly reason?: string;
  readonly occurredAt: string;
}
