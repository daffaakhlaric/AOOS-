import {
  WorkflowIntegrationException,
  type WorkflowIntegrationExceptionOptions,
} from "./workflow-integration-exception.js";

/** Thrown by `validator/`'s Validation Pipeline when it rejects an integration request before it may proceed. */
export class IntegrationValidationException extends WorkflowIntegrationException {
  constructor(message: string, options: WorkflowIntegrationExceptionOptions = {}) {
    super(message, options);
  }
}
