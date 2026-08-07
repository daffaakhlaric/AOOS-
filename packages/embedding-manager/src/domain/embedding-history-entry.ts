/** One immutable entry in an Embedding's transition history, appended by the State Machine. */
export interface EmbeddingHistoryEntry {
  readonly id: string;
  readonly sequence: number;
  readonly embeddingId: string;
  readonly operation: string;
  readonly fromState?: string;
  readonly toState?: string;
  readonly reason?: string;
  readonly occurredAt: string;
}
