import type { KnowledgeGenerationHistoryEntry } from "../domain/knowledge-generation-history-entry.js";
import {
  KNOWLEDGE_GENERATION_STATE_TRANSITIONS,
  KnowledgeGenerationState,
} from "../domain/knowledge-generation-state.js";
import type { KnowledgeGeneratorExecution } from "../domain/knowledge-generator-execution.js";
import { IllegalGenerationTransitionException } from "../errors/illegal-generation-transition-exception.js";
import { generateId } from "../utils/id.js";

import type {
  IKnowledgeGeneratorStateMachine,
  KnowledgeGeneratorStateTransitionInput,
} from "./i-state-machine.js";

/**
 * "Implement strict FSM. ... Destroyed is terminal." (docs/PROMPT-005.7K-KNOWLEDGE-
 * GENERATOR.md) — the only code in this package allowed to change
 * `KnowledgeGeneration.state`. Appends one immutable history entry per legal transition
 * and stamps `startedAt`/`completedAt` on the corresponding transitions.
 */
export class KnowledgeGeneratorStateMachine implements IKnowledgeGeneratorStateMachine {
  canTransition(from: KnowledgeGenerationState, to: KnowledgeGenerationState): boolean {
    return KNOWLEDGE_GENERATION_STATE_TRANSITIONS[from].includes(to);
  }

  transition(input: KnowledgeGeneratorStateTransitionInput): KnowledgeGeneratorExecution {
    const { execution, to, operation, reason } = input;
    const from = execution.instance.state;
    if (!this.canTransition(from, to)) {
      throw new IllegalGenerationTransitionException(
        `Illegal Knowledge Generation State transition for "${execution.instance.token}": "${from}" -> "${to}"`,
      );
    }

    const now = new Date().toISOString();
    const historyEntry: KnowledgeGenerationHistoryEntry = {
      id: generateId(),
      sequence: execution.history.length,
      generationId: execution.instance.generationId,
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
        startedAt: to === KnowledgeGenerationState.GENERATING ? now : execution.instance.startedAt,
        completedAt:
          to === KnowledgeGenerationState.COMPLETED ? now : execution.instance.completedAt,
      },
      history: [...execution.history, historyEntry],
    };
  }
}
