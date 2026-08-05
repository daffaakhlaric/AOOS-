import { SchedulerException, type SchedulerExceptionOptions } from "./scheduler-exception.js";

/** Raised when a Job State Machine transition is invalid (e.g. resuming a Completed job). */
export class StateTransitionException extends SchedulerException {
  constructor(message: string, options?: SchedulerExceptionOptions) {
    super(message, options);
  }
}
