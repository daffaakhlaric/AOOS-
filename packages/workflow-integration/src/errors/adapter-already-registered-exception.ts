import {
  WorkflowIntegrationException,
  type WorkflowIntegrationExceptionOptions,
} from "./workflow-integration-exception.js";

/** Thrown by `registry/workflow-integration-registry.ts#register()` when an Adapter with the same namespace + version is already registered — use `replace()` instead. */
export class AdapterAlreadyRegisteredException extends WorkflowIntegrationException {
  constructor(message: string, options: WorkflowIntegrationExceptionOptions = {}) {
    super(message, options);
  }
}
