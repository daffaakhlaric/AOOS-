import {
  EMBEDDING_SETTLED_STATES,
  EMBEDDING_STATE_TRANSITIONS,
  EMBEDDING_TERMINAL_STATES,
  EmbeddingState,
} from "../domain/embedding-state.js";

/**
 * "EmbeddingLifecycle" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Public API") — a
 * read-only, query-only companion to `EmbeddingStateMachine` (which performs the actual
 * mutations). Lets a caller introspect the 9-state Embedding Lifecycle without importing
 * the domain transition table directly.
 */
export class EmbeddingLifecycle {
  states(): readonly EmbeddingState[] {
    return Object.values(EmbeddingState);
  }

  transitionsFrom(state: EmbeddingState): readonly EmbeddingState[] {
    return EMBEDDING_STATE_TRANSITIONS[state];
  }

  isTerminal(state: EmbeddingState): boolean {
    return EMBEDDING_TERMINAL_STATES.has(state);
  }

  isSettled(state: EmbeddingState): boolean {
    return EMBEDDING_SETTLED_STATES.has(state);
  }
}
