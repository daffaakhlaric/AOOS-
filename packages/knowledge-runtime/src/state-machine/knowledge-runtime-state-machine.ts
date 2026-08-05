import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";
import type { KnowledgeRuntimeHistoryEntry } from "../domain/knowledge-runtime-history.js";
import {
  KNOWLEDGE_RUNTIME_STATE_TRANSITIONS,
  type KnowledgeRuntimeState,
} from "../domain/knowledge-runtime-state.js";
import { IllegalRuntimeTransitionException } from "../errors/illegal-runtime-transition-exception.js";

import type {
  IKnowledgeRuntimeStateMachine,
  KnowledgeRuntimeStateTransitionInput,
} from "./i-state-machine.js";

/** "Implement a strict finite-state machine. No illegal transitions." (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) — the only code in this package allowed to change `KnowledgeRuntimeInstance.state`. */
export class KnowledgeRuntimeStateMachine implements IKnowledgeRuntimeStateMachine {
  canTransition(from: KnowledgeRuntimeState, to: KnowledgeRuntimeState): boolean {
    return KNOWLEDGE_RUNTIME_STATE_TRANSITIONS[from].includes(to);
  }

  transition(input: KnowledgeRuntimeStateTransitionInput): KnowledgeRuntimeExecution {
    const { execution, to, reason } = input;
    const from = execution.instance.state;
    if (!this.canTransition(from, to)) {
      throw new IllegalRuntimeTransitionException(
        `Illegal Knowledge Runtime State transition for "${execution.instance.token}": "${from}" -> "${to}"`,
      );
    }

    const now = new Date().toISOString();
    const historyEntry: KnowledgeRuntimeHistoryEntry = {
      sequence: execution.history.length,
      fromState: from,
      toState: to,
      occurredAt: now,
      reason,
    };

    return {
      instance: {
        ...execution.instance,
        state: to,
        updatedAt: now,
        statistics: {
          ...execution.instance.statistics,
          transitionCount: execution.instance.statistics.transitionCount + 1,
        },
      },
      context: execution.context,
      history: [...execution.history, historyEntry],
    };
  }
}
