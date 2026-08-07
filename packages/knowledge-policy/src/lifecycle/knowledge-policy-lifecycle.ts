import {
  KNOWLEDGE_POLICY_SETTLED_STATES,
  KNOWLEDGE_POLICY_STATE_TRANSITIONS,
  KNOWLEDGE_POLICY_TERMINAL_STATES,
  KnowledgePolicyState,
} from "../domain/knowledge-policy-state.js";

/**
 * "KnowledgePolicyLifecycle" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Public API") —
 * a read-only, query-only companion to `KnowledgePolicyStateMachine` (which performs
 * the actual mutations). Lets a caller introspect the 9-state Policy Lifecycle without
 * importing the domain transition table directly.
 */
export class KnowledgePolicyLifecycle {
  states(): readonly KnowledgePolicyState[] {
    return Object.values(KnowledgePolicyState);
  }

  transitionsFrom(state: KnowledgePolicyState): readonly KnowledgePolicyState[] {
    return KNOWLEDGE_POLICY_STATE_TRANSITIONS[state];
  }

  isTerminal(state: KnowledgePolicyState): boolean {
    return KNOWLEDGE_POLICY_TERMINAL_STATES.has(state);
  }

  isSettled(state: KnowledgePolicyState): boolean {
    return KNOWLEDGE_POLICY_SETTLED_STATES.has(state);
  }
}
