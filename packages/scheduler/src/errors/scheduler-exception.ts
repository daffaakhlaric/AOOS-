import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface SchedulerExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/**
 * Base class for every exception raised by the Scheduler. Never thrown directly — always
 * via one of the concrete subclasses below (Constitution §16 Error Handling Standards).
 */
export class SchedulerException extends AosError {
  constructor(message: string, options: SchedulerExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
