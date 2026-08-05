import {
  WorkflowDefinitionException,
  type WorkflowDefinitionExceptionOptions,
} from "./workflow-definition-exception.js";

/** Raised by the Workflow Definition / Schema / Version registries (e.g. not found, already exists, invalid transition). */
export class RegistryException extends WorkflowDefinitionException {
  constructor(message: string, options?: WorkflowDefinitionExceptionOptions) {
    super(message, options);
  }
}
