import { SchedulerException, type SchedulerExceptionOptions } from "./scheduler-exception.js";

/** Raised when the Dispatcher cannot acquire a Distributed Lock for a Job before its dispatch window elapses. */
export class LockAcquisitionException extends SchedulerException {
  constructor(message: string, options?: SchedulerExceptionOptions) {
    super(message, options);
  }
}
