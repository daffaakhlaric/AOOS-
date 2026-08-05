import type { KnowledgeSourceExecution } from "../domain/knowledge-source-execution.js";
import type { KnowledgeSourceHistoryEntry } from "../domain/knowledge-source-history.js";
import {
  KNOWLEDGE_SOURCE_STATE_TRANSITIONS,
  type KnowledgeSourceState,
} from "../domain/knowledge-source-state.js";
import { IllegalSourceTransitionException } from "../errors/illegal-source-transition-exception.js";

import type {
  IKnowledgeSourceStateMachine,
  KnowledgeSourceStateTransitionInput,
} from "./i-state-machine.js";

/** "Implement a strict finite-state machine." — the only code in this package allowed to change `KnowledgeSourceInstance.state`. */
export class KnowledgeSourceStateMachine implements IKnowledgeSourceStateMachine {
  canTransition(from: KnowledgeSourceState, to: KnowledgeSourceState): boolean {
    return KNOWLEDGE_SOURCE_STATE_TRANSITIONS[from].includes(to);
  }

  transition(input: KnowledgeSourceStateTransitionInput): KnowledgeSourceExecution {
    const { execution, to, reason } = input;
    const from = execution.instance.state;
    if (!this.canTransition(from, to)) {
      throw new IllegalSourceTransitionException(
        `Illegal Knowledge Source State transition for "${execution.instance.token}": "${from}" -> "${to}"`,
      );
    }

    const now = new Date().toISOString();
    const historyEntry: KnowledgeSourceHistoryEntry = {
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
