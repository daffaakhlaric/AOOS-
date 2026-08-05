import {
  WorkflowExecutionException,
  type WorkflowExecutionExceptionOptions,
} from "./workflow-execution-exception.js";

/** Thrown by `transition/transition-engine.ts` when no outgoing Transition matches the requested outcome and the Node is not an End Node. */
export class TransitionResolutionException extends WorkflowExecutionException {
  constructor(message: string, options: WorkflowExecutionExceptionOptions = {}) {
    super(message, options);
  }
}
