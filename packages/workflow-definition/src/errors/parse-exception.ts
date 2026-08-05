import {
  WorkflowDefinitionException,
  type WorkflowDefinitionExceptionOptions,
} from "./workflow-definition-exception.js";

/** Raised when YAML/JSON source text cannot be parsed into a Workflow Definition. */
export class ParseException extends WorkflowDefinitionException {
  constructor(message: string, options?: WorkflowDefinitionExceptionOptions) {
    super(message, options);
  }
}
