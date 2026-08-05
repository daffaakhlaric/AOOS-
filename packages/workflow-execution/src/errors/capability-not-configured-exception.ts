import {
  WorkflowExecutionException,
  type WorkflowExecutionExceptionOptions,
} from "./workflow-execution-exception.js";

/**
 * Thrown when a Capability Node must execute but no `ICapabilityExecutor` was configured.
 * "Execution Engine MUST NEVER know implementation. Only define interface. Implementation
 * belongs to 005.9." (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md — "CAPABILITY EXECUTION").
 */
export class CapabilityNotConfiguredException extends WorkflowExecutionException {
  constructor(message: string, options: WorkflowExecutionExceptionOptions = {}) {
    super(message, options);
  }
}
