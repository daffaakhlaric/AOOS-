import type { KnowledgePolicyExecution } from "../domain/knowledge-policy-execution.js";
import type { KnowledgePolicyState } from "../domain/knowledge-policy-state.js";

export interface KnowledgePolicyStateTransitionInput {
  readonly execution: KnowledgePolicyExecution;
  readonly to: KnowledgePolicyState;
  readonly operation?: string;
  readonly reason?: string;
}

export interface IKnowledgePolicyStateMachine {
  canTransition(from: KnowledgePolicyState, to: KnowledgePolicyState): boolean;
  transition(input: KnowledgePolicyStateTransitionInput): KnowledgePolicyExecution;
}
