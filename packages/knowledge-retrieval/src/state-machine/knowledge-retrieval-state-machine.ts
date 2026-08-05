import type { KnowledgeRetrievalExecution } from "../domain/knowledge-retrieval-execution.js";
import type { KnowledgeRetrievalHistoryEntry } from "../domain/knowledge-retrieval-history.js";
import {
  KNOWLEDGE_RETRIEVAL_STATE_TRANSITIONS,
  type KnowledgeRetrievalState,
} from "../domain/knowledge-retrieval-state.js";
import { IllegalRetrievalTransitionException } from "../errors/illegal-retrieval-transition-exception.js";

import type {
  IKnowledgeRetrievalStateMachine,
  KnowledgeRetrievalStateTransitionInput,
} from "./i-state-machine.js";

/** "Implement a strict finite-state machine." (mirroring `@aos/knowledge-runtime`'s own instruction) — the only code in this package allowed to change `KnowledgeRetrievalInstance.state`. */
export class KnowledgeRetrievalStateMachine implements IKnowledgeRetrievalStateMachine {
  canTransition(from: KnowledgeRetrievalState, to: KnowledgeRetrievalState): boolean {
    return KNOWLEDGE_RETRIEVAL_STATE_TRANSITIONS[from].includes(to);
  }

  transition(input: KnowledgeRetrievalStateTransitionInput): KnowledgeRetrievalExecution {
    const { execution, to, reason } = input;
    const from = execution.instance.state;
    if (!this.canTransition(from, to)) {
      throw new IllegalRetrievalTransitionException(
        `Illegal Knowledge Retrieval State transition for "${execution.instance.token}": "${from}" -> "${to}"`,
      );
    }

    const now = new Date().toISOString();
    const historyEntry: KnowledgeRetrievalHistoryEntry = {
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
