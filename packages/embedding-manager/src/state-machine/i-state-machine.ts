import type { EmbeddingExecution } from "../domain/embedding-execution.js";
import type { EmbeddingState } from "../domain/embedding-state.js";

export interface EmbeddingStateTransitionInput {
  readonly execution: EmbeddingExecution;
  readonly to: EmbeddingState;
  readonly operation?: string;
  readonly reason?: string;
}

export interface IEmbeddingStateMachine {
  canTransition(from: EmbeddingState, to: EmbeddingState): boolean;
  transition(input: EmbeddingStateTransitionInput): EmbeddingExecution;
}
