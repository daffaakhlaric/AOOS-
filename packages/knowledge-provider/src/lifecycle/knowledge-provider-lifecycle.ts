import {
  KNOWLEDGE_PROVIDER_SETTLED_STATES,
  KNOWLEDGE_PROVIDER_STATE_TRANSITIONS,
  KNOWLEDGE_PROVIDER_TERMINAL_STATES,
  KnowledgeProviderState,
} from "../domain/knowledge-provider-state.js";

/**
 * "KnowledgeProviderLifecycle" (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md — "PUBLIC API")
 * — a read-only, query-only companion to `KnowledgeProviderStateMachine` (which performs
 * the actual mutations). Lets a caller introspect the 10-state Provider Lifecycle —
 * which states exist, which transitions are legal from a given state, and which states
 * are terminal/settled — without importing the domain transition table directly.
 */
export class KnowledgeProviderLifecycle {
  states(): readonly KnowledgeProviderState[] {
    return Object.values(KnowledgeProviderState);
  }

  transitionsFrom(state: KnowledgeProviderState): readonly KnowledgeProviderState[] {
    return KNOWLEDGE_PROVIDER_STATE_TRANSITIONS[state];
  }

  isTerminal(state: KnowledgeProviderState): boolean {
    return KNOWLEDGE_PROVIDER_TERMINAL_STATES.has(state);
  }

  isSettled(state: KnowledgeProviderState): boolean {
    return KNOWLEDGE_PROVIDER_SETTLED_STATES.has(state);
  }
}
