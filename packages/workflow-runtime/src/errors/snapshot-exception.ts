import {
  WorkflowRuntimeException,
  type WorkflowRuntimeExceptionOptions,
} from "./workflow-runtime-exception.js";

/** Thrown by `snapshot/` when a Snapshot cannot be captured or resolved (e.g. no Snapshot exists yet for a given `ExecutionToken`). */
export class SnapshotException extends WorkflowRuntimeException {
  constructor(message: string, options: WorkflowRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
