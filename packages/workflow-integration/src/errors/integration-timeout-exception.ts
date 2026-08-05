import {
  WorkflowIntegrationException,
  type WorkflowIntegrationExceptionOptions,
} from "./workflow-integration-exception.js";

/** Thrown by `middleware/timeout-middleware.ts` when an integration attempt exceeds its configured timeout. */
export class IntegrationTimeoutException extends WorkflowIntegrationException {
  constructor(message: string, options: WorkflowIntegrationExceptionOptions = {}) {
    super(message, options);
  }
}
