import type { ExecutionSession } from "../engine/execution-session.js";
import { IllegalExecutionTransitionException } from "../errors/illegal-execution-transition-exception.js";
import type { ExecutionHistoryEntry } from "../result/execution-history.js";

import { EXECUTION_STATE_TRANSITIONS } from "./execution-state.js";
import type { ExecutionState } from "./execution-state.js";
import type {
  ExecutionStateTransitionInput,
  IExecutionStateMachine,
} from "./i-execution-state-machine.js";

/** The only code in this package allowed to change `ExecutionContext.currentState`. */
export class ExecutionStateMachine implements IExecutionStateMachine {
  canTransition(from: ExecutionState, to: ExecutionState): boolean {
    return EXECUTION_STATE_TRANSITIONS[from].includes(to);
  }

  transition(input: ExecutionStateTransitionInput): ExecutionSession {
    const { session, to, nodeId, reason } = input;
    const from = session.context.currentState;
    if (!this.canTransition(from, to)) {
      throw new IllegalExecutionTransitionException(
        `Illegal Execution State transition for "${session.context.token.workflowExecutionId}": "${from}" -> "${to}"`,
      );
    }

    const historyEntry: ExecutionHistoryEntry = {
      sequence: session.history.length,
      fromState: from,
      toState: to,
      occurredAt: new Date().toISOString(),
      nodeId,
      reason,
    };

    return {
      definition: session.definition,
      context: { ...session.context, currentState: to },
      cursor: session.cursor,
      history: [...session.history, historyEntry],
      statistics: session.statistics,
    };
  }
}
