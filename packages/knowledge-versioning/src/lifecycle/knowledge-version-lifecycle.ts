import {
  KNOWLEDGE_VERSION_SETTLED_STATES,
  KNOWLEDGE_VERSION_STATE_TRANSITIONS,
  KNOWLEDGE_VERSION_TERMINAL_STATES,
  KnowledgeVersionState,
} from "../domain/knowledge-version-state.js";

/**
 * "KnowledgeVersionLifecycle" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Public
 * API") — a read-only, query-only companion to `KnowledgeVersionStateMachine` (which
 * performs the actual mutations). Lets a caller introspect the 11-state Version
 * Lifecycle — which states exist, which transitions are legal from a given state, and
 * which states are terminal/settled — without importing the domain transition table
 * directly.
 */
export class KnowledgeVersionLifecycle {
  states(): readonly KnowledgeVersionState[] {
    return Object.values(KnowledgeVersionState);
  }

  transitionsFrom(state: KnowledgeVersionState): readonly KnowledgeVersionState[] {
    return KNOWLEDGE_VERSION_STATE_TRANSITIONS[state];
  }

  isTerminal(state: KnowledgeVersionState): boolean {
    return KNOWLEDGE_VERSION_TERMINAL_STATES.has(state);
  }

  isSettled(state: KnowledgeVersionState): boolean {
    return KNOWLEDGE_VERSION_SETTLED_STATES.has(state);
  }
}
