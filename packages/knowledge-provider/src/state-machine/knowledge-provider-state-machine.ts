import type { KnowledgeProviderExecution } from "../domain/knowledge-provider-execution.js";
import type { KnowledgeProviderHistoryEntry } from "../domain/knowledge-provider-history.js";
import {
  KNOWLEDGE_PROVIDER_STATE_TRANSITIONS,
  type KnowledgeProviderState,
} from "../domain/knowledge-provider-state.js";
import { IllegalProviderTransitionException } from "../errors/illegal-provider-transition-exception.js";

import type {
  IKnowledgeProviderStateMachine,
  KnowledgeProviderStateTransitionInput,
} from "./i-state-machine.js";

/** "Implement a strict finite-state machine." — the only code in this package allowed to change `KnowledgeProviderInstance.state`. */
export class KnowledgeProviderStateMachine implements IKnowledgeProviderStateMachine {
  canTransition(from: KnowledgeProviderState, to: KnowledgeProviderState): boolean {
    return KNOWLEDGE_PROVIDER_STATE_TRANSITIONS[from].includes(to);
  }

  transition(input: KnowledgeProviderStateTransitionInput): KnowledgeProviderExecution {
    const { execution, to, reason } = input;
    const from = execution.instance.state;
    if (!this.canTransition(from, to)) {
      throw new IllegalProviderTransitionException(
        `Illegal Knowledge Provider State transition for "${execution.instance.token}": "${from}" -> "${to}"`,
      );
    }

    const now = new Date().toISOString();
    const historyEntry: KnowledgeProviderHistoryEntry = {
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
