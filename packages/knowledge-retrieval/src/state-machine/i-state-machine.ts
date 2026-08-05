import type { KnowledgeRetrievalExecution } from "../domain/knowledge-retrieval-execution.js";
import type { KnowledgeRetrievalState } from "../domain/knowledge-retrieval-state.js";

export interface KnowledgeRetrievalStateTransitionInput {
  readonly execution: KnowledgeRetrievalExecution;
  readonly to: KnowledgeRetrievalState;
  readonly reason?: string;
}

export interface IKnowledgeRetrievalStateMachine {
  canTransition(from: KnowledgeRetrievalState, to: KnowledgeRetrievalState): boolean;
  transition(input: KnowledgeRetrievalStateTransitionInput): KnowledgeRetrievalExecution;
}
