import type { EmbeddingExecution } from "../domain/embedding-execution.js";
import type { EmbeddingHistoryEntry } from "../domain/embedding-history-entry.js";
import { EMBEDDING_STATE_TRANSITIONS, EmbeddingState } from "../domain/embedding-state.js";
import { IllegalEmbeddingTransitionException } from "../errors/illegal-embedding-transition-exception.js";
import { generateId } from "../utils/id.js";

import type { EmbeddingStateTransitionInput, IEmbeddingStateMachine } from "./i-state-machine.js";

/**
 * "Implement strict FSM. ... Destroyed is terminal." (docs/PROMPT-005.7N-EMBEDDING-
 * MANAGER.md) — the only code in this package allowed to change `Embedding.state`.
 * Appends one immutable history entry per legal transition and stamps
 * `startedAt`/`settledAt` on the corresponding transitions. `startedAt` is stamped on
 * the transition into `EmbeddingState.EMBEDDING` (the in-progress state, distinct from
 * the `Embedding` domain aggregate of the same spelling); `settledAt` is stamped on the
 * transition into any of the four settled outcomes (Completed/Failed/Cancelled/Archived).
 */
export class EmbeddingStateMachine implements IEmbeddingStateMachine {
  canTransition(from: EmbeddingState, to: EmbeddingState): boolean {
    return EMBEDDING_STATE_TRANSITIONS[from].includes(to);
  }

  transition(input: EmbeddingStateTransitionInput): EmbeddingExecution {
    const { execution, to, operation, reason } = input;
    const from = execution.instance.state;
    if (!this.canTransition(from, to)) {
      throw new IllegalEmbeddingTransitionException(
        `Illegal Embedding State transition for "${execution.instance.token}": "${from}" -> "${to}"`,
      );
    }

    const now = new Date().toISOString();
    const historyEntry: EmbeddingHistoryEntry = {
      id: generateId(),
      sequence: execution.history.length,
      embeddingId: execution.instance.embeddingId,
      operation: operation ?? "transition",
      fromState: from,
      toState: to,
      reason,
      occurredAt: now,
    };

    const isSettling =
      to === EmbeddingState.COMPLETED ||
      to === EmbeddingState.FAILED ||
      to === EmbeddingState.CANCELLED ||
      to === EmbeddingState.ARCHIVED;

    return {
      ...execution,
      instance: {
        ...execution.instance,
        state: to,
        updatedAt: now,
        startedAt: to === EmbeddingState.EMBEDDING ? now : execution.instance.startedAt,
        settledAt: isSettling ? now : execution.instance.settledAt,
      },
      history: [...execution.history, historyEntry],
    };
  }
}
