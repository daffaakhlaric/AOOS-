import type { ExecutionSession } from "../engine/execution-session.js";

import type { ExecutionState } from "./execution-state.js";

export interface ExecutionStateTransitionInput {
  readonly session: ExecutionSession;
  readonly to: ExecutionState;
  readonly nodeId?: string;
  readonly reason?: string;
}

export interface IExecutionStateMachine {
  canTransition(from: ExecutionState, to: ExecutionState): boolean;
  transition(input: ExecutionStateTransitionInput): ExecutionSession;
}
