import { SchedulerException, type SchedulerExceptionOptions } from "./scheduler-exception.js";

/** Raised when a Job's Retry Policy `maxAttempts` has been exhausted. */
export class RetryExhaustedException extends SchedulerException {
  constructor(message: string, options?: SchedulerExceptionOptions) {
    super(message, options);
  }
}
