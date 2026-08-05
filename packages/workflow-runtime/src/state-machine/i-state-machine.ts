import type { InstanceState } from "../instance/instance-state.js";
import type { WorkflowExecution } from "../instance/workflow-execution.js";

export interface StateTransitionInput {
  readonly execution: WorkflowExecution;
  readonly to: InstanceState;
  readonly reason?: string;
}

export interface IWorkflowStateMachine {
  /** Returns `true` without throwing — used by callers that want to branch rather than catch. */
  canTransition(from: InstanceState, to: InstanceState): boolean;
  /** Applies the transition (updating `instance.status`/`updatedAt`, `context.currentState`, and appending a `WorkflowHistoryEntry`) or throws `IllegalTransitionException`. */
  transition(input: StateTransitionInput): WorkflowExecution;
}
