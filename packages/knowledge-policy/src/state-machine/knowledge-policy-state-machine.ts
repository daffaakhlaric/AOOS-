import type {
  KnowledgePolicyHistoryEntry,
  KnowledgePolicyExecution,
} from "../domain/knowledge-policy-execution.js";
import {
  KNOWLEDGE_POLICY_STATE_TRANSITIONS,
  KnowledgePolicyState,
} from "../domain/knowledge-policy-state.js";
import { IllegalPolicyTransitionException } from "../errors/illegal-policy-transition-exception.js";
import { generateId } from "../utils/id.js";

import type {
  IKnowledgePolicyStateMachine,
  KnowledgePolicyStateTransitionInput,
} from "./i-state-machine.js";

/**
 * "Implement a deterministic finite-state machine. ... Strict transition rules. No
 * implicit transitions. Validation before state changes. Illegal transitions rejected."
 * (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md) — the only code in this package allowed
 * to change `KnowledgePolicyInstance.state`. Appends one immutable history entry per
 * legal transition and stamps `activatedAt`/`destroyedAt` on the corresponding transitions.
 */
export class KnowledgePolicyStateMachine implements IKnowledgePolicyStateMachine {
  canTransition(from: KnowledgePolicyState, to: KnowledgePolicyState): boolean {
    return KNOWLEDGE_POLICY_STATE_TRANSITIONS[from].includes(to);
  }

  transition(input: KnowledgePolicyStateTransitionInput): KnowledgePolicyExecution {
    const { execution, to, operation, reason } = input;
    const from = execution.instance.state;
    if (!this.canTransition(from, to)) {
      throw new IllegalPolicyTransitionException(
        `Illegal Knowledge Policy State transition for "${execution.instance.token}": "${from}" -> "${to}"`,
      );
    }

    const now = new Date().toISOString();
    const historyEntry: KnowledgePolicyHistoryEntry = {
      id: generateId(),
      sequence: execution.history.length,
      policyId: execution.metadata.policyId,
      operation: operation ?? "transition",
      fromState: from,
      toState: to,
      reason,
      occurredAt: now,
    };

    return {
      ...execution,
      instance: {
        ...execution.instance,
        state: to,
        updatedAt: now,
        activatedAt: to === KnowledgePolicyState.ACTIVE ? now : execution.instance.activatedAt,
        destroyedAt: to === KnowledgePolicyState.DESTROYED ? now : execution.instance.destroyedAt,
      },
      history: [...execution.history, historyEntry],
    };
  }
}
