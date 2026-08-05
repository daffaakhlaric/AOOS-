import {
  WorkflowRuntimeException,
  type WorkflowRuntimeExceptionOptions,
} from "./workflow-runtime-exception.js";

/** Thrown when a Workflow Instance cannot be resolved by its `ExecutionToken` — every pause/resume/cancel/replay operation looks up state by token, never by scanning. */
export class InstanceNotFoundException extends WorkflowRuntimeException {
  constructor(message: string, options: WorkflowRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
