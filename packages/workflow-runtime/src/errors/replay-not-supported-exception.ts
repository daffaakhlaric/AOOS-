import {
  WorkflowRuntimeException,
  type WorkflowRuntimeExceptionOptions,
} from "./workflow-runtime-exception.js";

/** Thrown by `runtime/workflow-runtime.ts`'s `replay()` when no `IWorkflowReplay` provider was configured — Replay is an interface-only integration point in this package (no replay execution). */
export class ReplayNotSupportedException extends WorkflowRuntimeException {
  constructor(message: string, options: WorkflowRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
