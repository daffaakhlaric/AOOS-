import {
  WorkflowIntegrationException,
  type WorkflowIntegrationExceptionOptions,
} from "./workflow-integration-exception.js";

/** Thrown by `middleware/retry-middleware.ts` when an integration attempt's Retry Policy has exhausted every attempt. */
export class IntegrationRetryExhaustedException extends WorkflowIntegrationException {
  constructor(message: string, options: WorkflowIntegrationExceptionOptions = {}) {
    super(message, options);
  }
}
