import type { KnowledgeProviderExecution } from "../domain/knowledge-provider-execution.js";
import type { KnowledgeProviderState } from "../domain/knowledge-provider-state.js";

export interface KnowledgeProviderStateTransitionInput {
  readonly execution: KnowledgeProviderExecution;
  readonly to: KnowledgeProviderState;
  readonly reason?: string;
}

export interface IKnowledgeProviderStateMachine {
  canTransition(from: KnowledgeProviderState, to: KnowledgeProviderState): boolean;
  transition(input: KnowledgeProviderStateTransitionInput): KnowledgeProviderExecution;
}
