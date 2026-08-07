/** One immutable entry in a Generation's transition history, appended by the State Machine. */
export interface KnowledgeGenerationHistoryEntry {
  readonly id: string;
  readonly sequence: number;
  readonly generationId: string;
  readonly operation: string;
  readonly fromState?: string;
  readonly toState?: string;
  readonly reason?: string;
  readonly occurredAt: string;
}
