import type { KnowledgeValidationExecution } from "../domain/knowledge-validation-execution.js";
import type { KnowledgeValidationState } from "../domain/knowledge-validation-state.js";

export interface KnowledgeValidationStateTransitionInput {
  readonly execution: KnowledgeValidationExecution;
  readonly to: KnowledgeValidationState;
  readonly operation?: string;
  readonly reason?: string;
}

export interface IKnowledgeValidatorStateMachine {
  canTransition(from: KnowledgeValidationState, to: KnowledgeValidationState): boolean;
  transition(input: KnowledgeValidationStateTransitionInput): KnowledgeValidationExecution;
}
