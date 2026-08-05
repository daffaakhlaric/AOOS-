import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";
import type { KnowledgeRuntimeState } from "../domain/knowledge-runtime-state.js";

export interface KnowledgeRuntimeStateTransitionInput {
  readonly execution: KnowledgeRuntimeExecution;
  readonly to: KnowledgeRuntimeState;
  readonly reason?: string;
}

export interface IKnowledgeRuntimeStateMachine {
  /** Returns `true` without throwing — used by callers that want to branch rather than catch. */
  canTransition(from: KnowledgeRuntimeState, to: KnowledgeRuntimeState): boolean;
  /** Applies the transition (updating `instance.state`/`updatedAt`, appending a `KnowledgeRuntimeHistoryEntry`) or throws `IllegalRuntimeTransitionException`. */
  transition(input: KnowledgeRuntimeStateTransitionInput): KnowledgeRuntimeExecution;
}
