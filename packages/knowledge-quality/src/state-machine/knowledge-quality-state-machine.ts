import type { KnowledgeQualityAssessmentHistoryEntry } from "../domain/knowledge-quality-assessment-history-entry.js";
import {
  KNOWLEDGE_QUALITY_ASSESSMENT_STATE_TRANSITIONS,
  KnowledgeQualityAssessmentState,
} from "../domain/knowledge-quality-assessment-state.js";
import type { KnowledgeQualityExecution } from "../domain/knowledge-quality-execution.js";
import { IllegalAssessmentTransitionException } from "../errors/illegal-assessment-transition-exception.js";
import { generateId } from "../utils/id.js";

import type {
  IKnowledgeQualityStateMachine,
  KnowledgeQualityStateTransitionInput,
} from "./i-state-machine.js";

/**
 * "Implement strict FSM. ... Destroyed is terminal." (docs/PROMPT-005.7L-KNOWLEDGE-
 * QUALITY.md) — the only code in this package allowed to change
 * `KnowledgeQualityAssessment.state`. Appends one immutable history entry per legal transition
 * and stamps `startedAt`/`completedAt` on the corresponding transitions.
 */
export class KnowledgeQualityStateMachine implements IKnowledgeQualityStateMachine {
  canTransition(
    from: KnowledgeQualityAssessmentState,
    to: KnowledgeQualityAssessmentState,
  ): boolean {
    return KNOWLEDGE_QUALITY_ASSESSMENT_STATE_TRANSITIONS[from].includes(to);
  }

  transition(input: KnowledgeQualityStateTransitionInput): KnowledgeQualityExecution {
    const { execution, to, operation, reason } = input;
    const from = execution.instance.state;
    if (!this.canTransition(from, to)) {
      throw new IllegalAssessmentTransitionException(
        `Illegal Knowledge Assessment State transition for "${execution.instance.token}": "${from}" -> "${to}"`,
      );
    }

    const now = new Date().toISOString();
    const historyEntry: KnowledgeQualityAssessmentHistoryEntry = {
      id: generateId(),
      sequence: execution.history.length,
      assessmentId: execution.instance.assessmentId,
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
        startedAt:
          to === KnowledgeQualityAssessmentState.ASSESSING ? now : execution.instance.startedAt,
        completedAt:
          to === KnowledgeQualityAssessmentState.COMPLETED ? now : execution.instance.completedAt,
      },
      history: [...execution.history, historyEntry],
    };
  }
}
