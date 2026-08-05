import {
  WorkflowExecutionException,
  type WorkflowExecutionExceptionOptions,
} from "./workflow-execution-exception.js";

/** Thrown when an Execution Session cannot be resolved by its `ExecutionToken` — every imperative operation looks up state by token, never by scanning. */
export class ExecutionNotFoundException extends WorkflowExecutionException {
  constructor(message: string, options: WorkflowExecutionExceptionOptions = {}) {
    super(message, options);
  }
}
