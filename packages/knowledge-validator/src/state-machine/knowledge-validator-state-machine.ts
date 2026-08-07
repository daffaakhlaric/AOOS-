import type { KnowledgeValidationExecution } from "../domain/knowledge-validation-execution.js";
import type { KnowledgeValidationHistoryEntry } from "../domain/knowledge-validation-history-entry.js";
import {
  KNOWLEDGE_VALIDATION_STATE_TRANSITIONS,
  KnowledgeValidationState,
} from "../domain/knowledge-validation-state.js";
import { IllegalValidationTransitionException } from "../errors/illegal-validation-transition-exception.js";
import { generateId } from "../utils/id.js";

import type {
  IKnowledgeValidatorStateMachine,
  KnowledgeValidationStateTransitionInput,
} from "./i-state-machine.js";

/**
 * "Implement strict FSM. ... Destroyed is terminal." (docs/PROMPT-005.7M-KNOWLEDGE-
 * VALIDATOR.md) — the only code in this package allowed to change
 * `KnowledgeValidation.state`. Appends one immutable history entry per legal transition
 * and stamps `startedAt`/`settledAt` on the corresponding transitions. `settledAt` is
 * stamped on the transition into EITHER Approved or Rejected — this Lifecycle's two
 * distinct settled outcomes from Reviewing (see docs/005.7M-KNOWLEDGE-VALIDATOR-AI-
 * REPORT.md — "Decision Lifecycle").
 */
export class KnowledgeValidatorStateMachine implements IKnowledgeValidatorStateMachine {
  canTransition(from: KnowledgeValidationState, to: KnowledgeValidationState): boolean {
    return KNOWLEDGE_VALIDATION_STATE_TRANSITIONS[from].includes(to);
  }

  transition(input: KnowledgeValidationStateTransitionInput): KnowledgeValidationExecution {
    const { execution, to, operation, reason } = input;
    const from = execution.instance.state;
    if (!this.canTransition(from, to)) {
      throw new IllegalValidationTransitionException(
        `Illegal Knowledge Validation State transition for "${execution.instance.token}": "${from}" -> "${to}"`,
      );
    }

    const now = new Date().toISOString();
    const historyEntry: KnowledgeValidationHistoryEntry = {
      id: generateId(),
      sequence: execution.history.length,
      validationId: execution.instance.validationId,
      operation: operation ?? "transition",
      fromState: from,
      toState: to,
      reason,
      occurredAt: now,
    };

    const isSettling =
      to === KnowledgeValidationState.APPROVED || to === KnowledgeValidationState.REJECTED;

    return {
      ...execution,
      instance: {
        ...execution.instance,
        state: to,
        updatedAt: now,
        startedAt: to === KnowledgeValidationState.VALIDATING ? now : execution.instance.startedAt,
        settledAt: isSettling ? now : execution.instance.settledAt,
      },
      history: [...execution.history, historyEntry],
    };
  }
}
