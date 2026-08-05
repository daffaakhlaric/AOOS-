import { SchedulerException, type SchedulerExceptionOptions } from "./scheduler-exception.js";

/** Raised when a Cron Expression cannot be parsed. */
export class CronParseException extends SchedulerException {
  constructor(message: string, options?: SchedulerExceptionOptions) {
    super(message, options);
  }
}
