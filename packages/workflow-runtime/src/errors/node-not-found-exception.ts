import {
  WorkflowRuntimeException,
  type WorkflowRuntimeExceptionOptions,
} from "./workflow-runtime-exception.js";

/** Thrown by `resolver/` when a Node id (or a required structural Node, e.g. Start) cannot be resolved within a Workflow Definition's Node graph. */
export class NodeNotFoundException extends WorkflowRuntimeException {
  constructor(message: string, options: WorkflowRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
