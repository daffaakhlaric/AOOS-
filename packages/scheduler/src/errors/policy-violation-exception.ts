import { SchedulerException, type SchedulerExceptionOptions } from "./scheduler-exception.js";

/** Raised when the Policy Pipeline rejects a Job's dispatch (e.g. blackout window, quota exceeded). */
export class PolicyViolationException extends SchedulerException {
  constructor(message: string, options?: SchedulerExceptionOptions) {
    super(message, options);
  }
}
