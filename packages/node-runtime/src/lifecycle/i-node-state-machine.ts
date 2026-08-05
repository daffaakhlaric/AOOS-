import type { NodeState } from "../contracts/node-state.js";
import type { NodeExecution } from "../instance/node-execution.js";

export interface NodeStateTransitionInput {
  readonly execution: NodeExecution;
  readonly to: NodeState;
  readonly reason?: string;
}

export interface INodeStateMachine {
  canTransition(from: NodeState, to: NodeState): boolean;
  transition(input: NodeStateTransitionInput): NodeExecution;
}
