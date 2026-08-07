import {
  KNOWLEDGE_VALIDATION_SETTLED_STATES,
  KNOWLEDGE_VALIDATION_STATE_TRANSITIONS,
  KNOWLEDGE_VALIDATION_TERMINAL_STATES,
  KnowledgeValidationState,
} from "../domain/knowledge-validation-state.js";

/**
 * "KnowledgeValidatorLifecycle" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Public
 * API") — a read-only, query-only companion to `KnowledgeValidatorStateMachine` (which
 * performs the actual mutations). Lets a caller introspect the 10-state Validation
 * Lifecycle without importing the domain transition table directly.
 */
export class KnowledgeValidatorLifecycle {
  states(): readonly KnowledgeValidationState[] {
    return Object.values(KnowledgeValidationState);
  }

  transitionsFrom(state: KnowledgeValidationState): readonly KnowledgeValidationState[] {
    return KNOWLEDGE_VALIDATION_STATE_TRANSITIONS[state];
  }

  isTerminal(state: KnowledgeValidationState): boolean {
    return KNOWLEDGE_VALIDATION_TERMINAL_STATES.has(state);
  }

  isSettled(state: KnowledgeValidationState): boolean {
    return KNOWLEDGE_VALIDATION_SETTLED_STATES.has(state);
  }
}
