import {
  WorkflowRuntimeException,
  type WorkflowRuntimeExceptionOptions,
} from "./workflow-runtime-exception.js";

/** Thrown when `validator/`'s runtime validation (definition-shape + tenant/mode compatibility) rejects a Workflow Definition before execution may begin. */
export class WorkflowValidationException extends WorkflowRuntimeException {
  constructor(message: string, options: WorkflowRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
