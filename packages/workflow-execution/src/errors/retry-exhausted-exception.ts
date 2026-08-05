import {
  WorkflowExecutionException,
  type WorkflowExecutionExceptionOptions,
} from "./workflow-execution-exception.js";

/** Thrown by `retry/retry-coordinator.ts` when a Node's Retry Policy has exhausted every attempt. */
export class RetryExhaustedException extends WorkflowExecutionException {
  constructor(message: string, options: WorkflowExecutionExceptionOptions = {}) {
    super(message, options);
  }
}
