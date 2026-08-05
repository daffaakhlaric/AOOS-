import {
  KNOWLEDGE_SYNCHRONIZATION_SETTLED_STATES,
  KNOWLEDGE_SYNCHRONIZATION_STATE_TRANSITIONS,
  KNOWLEDGE_SYNCHRONIZATION_TERMINAL_STATES,
  KnowledgeSynchronizationState,
} from "../domain/knowledge-synchronization-state.js";

/**
 * "KnowledgeSynchronizationLifecycle" (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md —
 * "PUBLIC API") — a read-only, query-only companion to `KnowledgeSynchronizationStateMachine`
 * (which performs the actual mutations). Lets a caller introspect the 13-state
 * Synchronization Lifecycle — which states exist, which transitions are legal from a
 * given state, and which states are terminal/settled — without importing the domain
 * transition table directly.
 */
export class KnowledgeSynchronizationLifecycle {
  states(): readonly KnowledgeSynchronizationState[] {
    return Object.values(KnowledgeSynchronizationState);
  }

  transitionsFrom(state: KnowledgeSynchronizationState): readonly KnowledgeSynchronizationState[] {
    return KNOWLEDGE_SYNCHRONIZATION_STATE_TRANSITIONS[state];
  }

  isTerminal(state: KnowledgeSynchronizationState): boolean {
    return KNOWLEDGE_SYNCHRONIZATION_TERMINAL_STATES.has(state);
  }

  isSettled(state: KnowledgeSynchronizationState): boolean {
    return KNOWLEDGE_SYNCHRONIZATION_SETTLED_STATES.has(state);
  }
}
