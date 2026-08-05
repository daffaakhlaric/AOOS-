import { IllegalTransitionException } from "../errors/illegal-transition-exception.js";
import { INSTANCE_STATE_TRANSITIONS, type InstanceState } from "../instance/instance-state.js";
import type { WorkflowExecution } from "../instance/workflow-execution.js";
import type { WorkflowHistoryEntry } from "../instance/workflow-history.js";

import type { IWorkflowStateMachine, StateTransitionInput } from "./i-state-machine.js";

/** The only code in this package allowed to change `WorkflowInstance.status`/`WorkflowContext.currentState`. */
export class WorkflowStateMachine implements IWorkflowStateMachine {
  canTransition(from: InstanceState, to: InstanceState): boolean {
    return INSTANCE_STATE_TRANSITIONS[from].includes(to);
  }

  transition(input: StateTransitionInput): WorkflowExecution {
    const { execution, to, reason } = input;
    const from = execution.instance.status;
    if (!this.canTransition(from, to)) {
      throw new IllegalTransitionException(
        `Illegal Instance State transition for "${execution.instance.token}": "${from}" -> "${to}"`,
      );
    }

    const now = new Date().toISOString();
    const historyEntry: WorkflowHistoryEntry = {
      sequence: execution.context.executionHistory.length,
      fromState: from,
      toState: to,
      occurredAt: now,
      reason,
    };

    return {
      definition: execution.definition,
      instance: {
        ...execution.instance,
        status: to,
        updatedAt: now,
      },
      context: {
        ...execution.context,
        currentState: to,
        executionHistory: [...execution.context.executionHistory, historyEntry],
      },
    };
  }
}
