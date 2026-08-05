import {
  WorkflowIntegrationException,
  type WorkflowIntegrationExceptionOptions,
} from "./workflow-integration-exception.js";

/** Thrown when an Adapter must delegate to an underlying runtime contract (e.g. `ICapabilityRuntime`) but none was injected — implementation belongs to a later Engineering Task. */
export class MissingRuntimeException extends WorkflowIntegrationException {
  constructor(message: string, options: WorkflowIntegrationExceptionOptions = {}) {
    super(message, options);
  }
}
