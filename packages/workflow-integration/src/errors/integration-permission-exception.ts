import {
  WorkflowIntegrationException,
  type WorkflowIntegrationExceptionOptions,
} from "./workflow-integration-exception.js";

/** Thrown by `middleware/permission-middleware.ts` when a configured `IWorkflowIntegrationPermissionChecker` denies an integration request. */
export class IntegrationPermissionException extends WorkflowIntegrationException {
  constructor(message: string, options: WorkflowIntegrationExceptionOptions = {}) {
    super(message, options);
  }
}
