import type { KnowledgeSynchronizationExecution } from "../domain/knowledge-synchronization-execution.js";
import type { KnowledgeSynchronizationHistoryEntry } from "../domain/knowledge-synchronization-history.js";
import {
  KNOWLEDGE_SYNCHRONIZATION_STATE_TRANSITIONS,
  type KnowledgeSynchronizationState,
} from "../domain/knowledge-synchronization-state.js";
import { IllegalSynchronizationTransitionException } from "../errors/illegal-synchronization-transition-exception.js";

import type {
  IKnowledgeSynchronizationStateMachine,
  KnowledgeSynchronizationStateTransitionInput,
} from "./i-state-machine.js";

/** "Implement a strict finite-state machine." — the only code in this package allowed to change `KnowledgeSynchronizationInstance.state`. */
export class KnowledgeSynchronizationStateMachine implements IKnowledgeSynchronizationStateMachine {
  canTransition(from: KnowledgeSynchronizationState, to: KnowledgeSynchronizationState): boolean {
    return KNOWLEDGE_SYNCHRONIZATION_STATE_TRANSITIONS[from].includes(to);
  }

  transition(
    input: KnowledgeSynchronizationStateTransitionInput,
  ): KnowledgeSynchronizationExecution {
    const { execution, to, reason } = input;
    const from = execution.instance.state;
    if (!this.canTransition(from, to)) {
      throw new IllegalSynchronizationTransitionException(
        `Illegal Knowledge Synchronization State transition for "${execution.instance.token}": "${from}" -> "${to}"`,
      );
    }

    const now = new Date().toISOString();
    const historyEntry: KnowledgeSynchronizationHistoryEntry = {
      sequence: execution.history.length,
      fromState: from,
      toState: to,
      occurredAt: now,
      reason,
    };

    return {
      ...execution,
      instance: { ...execution.instance, state: to, updatedAt: now },
      history: [...execution.history, historyEntry],
    };
  }
}
