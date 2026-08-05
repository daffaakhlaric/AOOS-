import {
  WorkflowDefinitionException,
  type WorkflowDefinitionExceptionOptions,
} from "./workflow-definition-exception.js";

/** Raised when the Builder API is used incorrectly (e.g. `.build()` before `.start()`). */
export class BuilderException extends WorkflowDefinitionException {
  constructor(message: string, options?: WorkflowDefinitionExceptionOptions) {
    super(message, options);
  }
}
