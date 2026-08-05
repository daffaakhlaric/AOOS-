import { SchedulerException, type SchedulerExceptionOptions } from "./scheduler-exception.js";

/** Raised when a Job/Schedule fails Schedule/Cron/Timezone/BusinessHour/Retry/Dependency/Tenant validation. */
export class ValidationException extends SchedulerException {
  constructor(message: string, options?: SchedulerExceptionOptions) {
    super(message, options);
  }
}
