import {
  WorkflowRuntimeException,
  type WorkflowRuntimeExceptionOptions,
} from "./workflow-runtime-exception.js";

/** Thrown by `lifecycle/` for a lifecycle operation that cannot proceed for a reason other than an illegal state transition (e.g. `restart()` — interface only, never implemented in this package). */
export class LifecycleException extends WorkflowRuntimeException {
  constructor(message: string, options: WorkflowRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
