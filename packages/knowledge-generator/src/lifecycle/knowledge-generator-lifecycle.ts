import {
  KNOWLEDGE_GENERATION_SETTLED_STATES,
  KNOWLEDGE_GENERATION_STATE_TRANSITIONS,
  KNOWLEDGE_GENERATION_TERMINAL_STATES,
  KnowledgeGenerationState,
} from "../domain/knowledge-generation-state.js";

/**
 * "KnowledgeGeneratorLifecycle" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Public
 * API") — a read-only, query-only companion to `KnowledgeGeneratorStateMachine` (which
 * performs the actual mutations). Lets a caller introspect the 10-state Generation
 * Lifecycle without importing the domain transition table directly.
 */
export class KnowledgeGeneratorLifecycle {
  states(): readonly KnowledgeGenerationState[] {
    return Object.values(KnowledgeGenerationState);
  }

  transitionsFrom(state: KnowledgeGenerationState): readonly KnowledgeGenerationState[] {
    return KNOWLEDGE_GENERATION_STATE_TRANSITIONS[state];
  }

  isTerminal(state: KnowledgeGenerationState): boolean {
    return KNOWLEDGE_GENERATION_TERMINAL_STATES.has(state);
  }

  isSettled(state: KnowledgeGenerationState): boolean {
    return KNOWLEDGE_GENERATION_SETTLED_STATES.has(state);
  }
}
