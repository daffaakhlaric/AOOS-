import {
  WorkflowExecutionException,
  type WorkflowExecutionExceptionOptions,
} from "./workflow-execution-exception.js";

/** Thrown when a Workflow/Node/Execution/Idle Timeout elapses (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md — "TIMEOUT"). */
export class ExecutionTimeoutException extends WorkflowExecutionException {
  constructor(message: string, options: WorkflowExecutionExceptionOptions = {}) {
    super(message, options);
  }
}
