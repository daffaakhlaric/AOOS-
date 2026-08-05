import {
  WorkflowExecutionException,
  type WorkflowExecutionExceptionOptions,
} from "./workflow-execution-exception.js";

/** Thrown by `graph/execution-graph.ts` when a Workflow Definition's runtime graph has a dead end, an orphan Node, or an unintended infinite loop. */
export class GraphValidationException extends WorkflowExecutionException {
  constructor(message: string, options: WorkflowExecutionExceptionOptions = {}) {
    super(message, options);
  }
}
