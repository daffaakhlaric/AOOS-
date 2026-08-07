import type { KnowledgeQualityAssessmentState } from "../domain/knowledge-quality-assessment-state.js";
import type { KnowledgeQualityExecution } from "../domain/knowledge-quality-execution.js";

export interface KnowledgeQualityStateTransitionInput {
  readonly execution: KnowledgeQualityExecution;
  readonly to: KnowledgeQualityAssessmentState;
  readonly operation?: string;
  readonly reason?: string;
}

export interface IKnowledgeQualityStateMachine {
  canTransition(
    from: KnowledgeQualityAssessmentState,
    to: KnowledgeQualityAssessmentState,
  ): boolean;
  transition(input: KnowledgeQualityStateTransitionInput): KnowledgeQualityExecution;
}
