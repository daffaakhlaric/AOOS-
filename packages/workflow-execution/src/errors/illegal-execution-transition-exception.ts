import {
  WorkflowExecutionException,
  type WorkflowExecutionExceptionOptions,
} from "./workflow-execution-exception.js";

/** Thrown by `state-machine/execution-state-machine.ts` when a requested Execution State transition is not present in `EXECUTION_STATE_TRANSITIONS`. */
export class IllegalExecutionTransitionException extends WorkflowExecutionException {
  constructor(message: string, options: WorkflowExecutionExceptionOptions = {}) {
    super(message, options);
  }
}
