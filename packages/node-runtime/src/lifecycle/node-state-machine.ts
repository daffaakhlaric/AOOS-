import { NODE_STATE_TRANSITIONS, type NodeState } from "../contracts/node-state.js";
import { IllegalNodeTransitionException } from "../errors/illegal-node-transition-exception.js";
import type { NodeExecution } from "../instance/node-execution.js";
import type { NodeHistoryEntry } from "../instance/node-history.js";

import type { INodeStateMachine, NodeStateTransitionInput } from "./i-node-state-machine.js";

/** The only code in this package allowed to change `NodeInstance.status`. */
export class NodeStateMachine implements INodeStateMachine {
  canTransition(from: NodeState, to: NodeState): boolean {
    return NODE_STATE_TRANSITIONS[from].includes(to);
  }

  transition(input: NodeStateTransitionInput): NodeExecution {
    const { execution, to, reason } = input;
    const from = execution.instance.status;
    if (!this.canTransition(from, to)) {
      throw new IllegalNodeTransitionException(
        `Illegal Node State transition for "${execution.instance.id}": "${from}" -> "${to}"`,
      );
    }

    const now = new Date().toISOString();
    const historyEntry: NodeHistoryEntry = {
      sequence: execution.history.length,
      fromState: from,
      toState: to,
      occurredAt: now,
      reason,
    };

    return {
      manifest: execution.manifest,
      instance: { ...execution.instance, status: to, updatedAt: now },
      context: execution.context,
      history: [...execution.history, historyEntry],
    };
  }
}
