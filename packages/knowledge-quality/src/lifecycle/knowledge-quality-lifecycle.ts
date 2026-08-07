import {
  KNOWLEDGE_QUALITY_ASSESSMENT_SETTLED_STATES,
  KNOWLEDGE_QUALITY_ASSESSMENT_STATE_TRANSITIONS,
  KNOWLEDGE_QUALITY_ASSESSMENT_TERMINAL_STATES,
  KnowledgeQualityAssessmentState,
} from "../domain/knowledge-quality-assessment-state.js";

/**
 * "KnowledgeQualityLifecycle" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Public
 * API") — a read-only, query-only companion to `KnowledgeQualityStateMachine` (which
 * performs the actual mutations). Lets a caller introspect the 10-state Assessment
 * Lifecycle without importing the domain transition table directly.
 */
export class KnowledgeQualityLifecycle {
  states(): readonly KnowledgeQualityAssessmentState[] {
    return Object.values(KnowledgeQualityAssessmentState);
  }

  transitionsFrom(
    state: KnowledgeQualityAssessmentState,
  ): readonly KnowledgeQualityAssessmentState[] {
    return KNOWLEDGE_QUALITY_ASSESSMENT_STATE_TRANSITIONS[state];
  }

  isTerminal(state: KnowledgeQualityAssessmentState): boolean {
    return KNOWLEDGE_QUALITY_ASSESSMENT_TERMINAL_STATES.has(state);
  }

  isSettled(state: KnowledgeQualityAssessmentState): boolean {
    return KNOWLEDGE_QUALITY_ASSESSMENT_SETTLED_STATES.has(state);
  }
}
