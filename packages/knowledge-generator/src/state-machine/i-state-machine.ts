import type { KnowledgeGenerationState } from "../domain/knowledge-generation-state.js";
import type { KnowledgeGeneratorExecution } from "../domain/knowledge-generator-execution.js";

export interface KnowledgeGeneratorStateTransitionInput {
  readonly execution: KnowledgeGeneratorExecution;
  readonly to: KnowledgeGenerationState;
  readonly operation?: string;
  readonly reason?: string;
}

export interface IKnowledgeGeneratorStateMachine {
  canTransition(from: KnowledgeGenerationState, to: KnowledgeGenerationState): boolean;
  transition(input: KnowledgeGeneratorStateTransitionInput): KnowledgeGeneratorExecution;
}
