import type { KnowledgeSourceExecution } from "../domain/knowledge-source-execution.js";
import type { KnowledgeSourceState } from "../domain/knowledge-source-state.js";

export interface KnowledgeSourceStateTransitionInput {
  readonly execution: KnowledgeSourceExecution;
  readonly to: KnowledgeSourceState;
  readonly reason?: string;
}

export interface IKnowledgeSourceStateMachine {
  canTransition(from: KnowledgeSourceState, to: KnowledgeSourceState): boolean;
  transition(input: KnowledgeSourceStateTransitionInput): KnowledgeSourceExecution;
}
