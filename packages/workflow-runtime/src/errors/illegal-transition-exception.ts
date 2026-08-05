import {
  WorkflowRuntimeException,
  type WorkflowRuntimeExceptionOptions,
} from "./workflow-runtime-exception.js";

/** Thrown by `state-machine/` when a requested Instance State transition is not present in `INSTANCE_STATE_TRANSITIONS`. */
export class IllegalTransitionException extends WorkflowRuntimeException {
  constructor(message: string, options: WorkflowRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
