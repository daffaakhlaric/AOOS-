import {
  WorkflowIntegrationException,
  type WorkflowIntegrationExceptionOptions,
} from "./workflow-integration-exception.js";

/** Thrown by `resolver/workflow-integration-resolver.ts` when no Adapter is registered for the requested namespace (and no lower-priority fallback exists). */
export class AdapterNotFoundException extends WorkflowIntegrationException {
  constructor(message: string, options: WorkflowIntegrationExceptionOptions = {}) {
    super(message, options);
  }
}
