import { SchedulerException, type SchedulerExceptionOptions } from "./scheduler-exception.js";

/** Raised for a missing or cyclic Job Dependency. */
export class DependencyException extends SchedulerException {
  constructor(message: string, options?: SchedulerExceptionOptions) {
    super(message, options);
  }
}
