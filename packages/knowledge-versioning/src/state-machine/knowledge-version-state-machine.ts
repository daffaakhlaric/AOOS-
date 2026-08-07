import type { KnowledgeHistoryEntry } from "../domain/knowledge-history.js";
import type { KnowledgeVersionExecution } from "../domain/knowledge-version-execution.js";
import {
  KNOWLEDGE_VERSION_STATE_TRANSITIONS,
  KnowledgeVersionState,
} from "../domain/knowledge-version-state.js";
import { IllegalVersionTransitionException } from "../errors/illegal-version-transition-exception.js";
import { generateId } from "../utils/id.js";

import type {
  IKnowledgeVersionStateMachine,
  KnowledgeVersionStateTransitionInput,
} from "./i-state-machine.js";

/**
 * "Implement a deterministic finite-state machine. ... Strict transition rules. No
 * implicit transitions. Validation before state changes. Illegal transitions rejected."
 * (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md) — the only code in this package allowed
 * to change `KnowledgeVersionInstance.state`. Appends one immutable history entry per
 * legal transition and stamps `publishedAt`/`destroyedAt` on the corresponding
 * transitions.
 */
export class KnowledgeVersionStateMachine implements IKnowledgeVersionStateMachine {
  canTransition(from: KnowledgeVersionState, to: KnowledgeVersionState): boolean {
    return KNOWLEDGE_VERSION_STATE_TRANSITIONS[from].includes(to);
  }

  transition(input: KnowledgeVersionStateTransitionInput): KnowledgeVersionExecution {
    const { execution, to, operation, reason } = input;
    const from = execution.instance.state;
    if (!this.canTransition(from, to)) {
      throw new IllegalVersionTransitionException(
        `Illegal Knowledge Version State transition for "${execution.instance.token}": "${from}" -> "${to}"`,
      );
    }

    const now = new Date().toISOString();
    const historyEntry: KnowledgeHistoryEntry = {
      id: generateId(),
      sequence: execution.history.length,
      versionId: execution.metadata.versionId,
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
        publishedAt: to === KnowledgeVersionState.PUBLISHED ? now : execution.instance.publishedAt,
        destroyedAt: to === KnowledgeVersionState.DESTROYED ? now : execution.instance.destroyedAt,
      },
      history: [...execution.history, historyEntry],
    };
  }
}
