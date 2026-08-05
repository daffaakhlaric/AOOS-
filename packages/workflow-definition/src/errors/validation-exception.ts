import {
  WorkflowDefinitionException,
  type WorkflowDefinitionExceptionOptions,
} from "./workflow-definition-exception.js";

/** Raised when a Workflow Definition fails Schema/Node/Transition/Variable/Expression/Version validation. */
export class ValidationException extends WorkflowDefinitionException {
  constructor(message: string, options?: WorkflowDefinitionExceptionOptions) {
    super(message, options);
  }
}
