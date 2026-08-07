import type { KnowledgeVersionExecution } from "../domain/knowledge-version-execution.js";
import type { KnowledgeVersionState } from "../domain/knowledge-version-state.js";

export interface KnowledgeVersionStateTransitionInput {
  readonly execution: KnowledgeVersionExecution;
  readonly to: KnowledgeVersionState;
  readonly operation?: string;
  readonly reason?: string;
}

export interface IKnowledgeVersionStateMachine {
  canTransition(from: KnowledgeVersionState, to: KnowledgeVersionState): boolean;
  transition(input: KnowledgeVersionStateTransitionInput): KnowledgeVersionExecution;
}
