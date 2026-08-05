import {
  KNOWLEDGE_SOURCE_SETTLED_STATES,
  KNOWLEDGE_SOURCE_STATE_TRANSITIONS,
  KNOWLEDGE_SOURCE_TERMINAL_STATES,
  KnowledgeSourceState,
} from "../domain/knowledge-source-state.js";

/**
 * "KnowledgeSourceLifecycle" (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md — "PUBLIC
 * API") — a read-only, query-only companion to `KnowledgeSourceStateMachine` (which
 * performs the actual mutations). Lets a caller introspect the 12-state Source Lifecycle
 * — which states exist, which transitions are legal from a given state, and which states
 * are terminal/settled — without importing the domain transition table directly.
 */
export class KnowledgeSourceLifecycle {
  states(): readonly KnowledgeSourceState[] {
    return Object.values(KnowledgeSourceState);
  }

  transitionsFrom(state: KnowledgeSourceState): readonly KnowledgeSourceState[] {
    return KNOWLEDGE_SOURCE_STATE_TRANSITIONS[state];
  }

  isTerminal(state: KnowledgeSourceState): boolean {
    return KNOWLEDGE_SOURCE_TERMINAL_STATES.has(state);
  }

  isSettled(state: KnowledgeSourceState): boolean {
    return KNOWLEDGE_SOURCE_SETTLED_STATES.has(state);
  }
}
