import type { KnowledgeSynchronizationExecution } from "../domain/knowledge-synchronization-execution.js";
import type { KnowledgeSynchronizationState } from "../domain/knowledge-synchronization-state.js";

export interface KnowledgeSynchronizationStateTransitionInput {
  readonly execution: KnowledgeSynchronizationExecution;
  readonly to: KnowledgeSynchronizationState;
  readonly reason?: string;
}

export interface IKnowledgeSynchronizationStateMachine {
  canTransition(from: KnowledgeSynchronizationState, to: KnowledgeSynchronizationState): boolean;
  transition(
    input: KnowledgeSynchronizationStateTransitionInput,
  ): KnowledgeSynchronizationExecution;
}
