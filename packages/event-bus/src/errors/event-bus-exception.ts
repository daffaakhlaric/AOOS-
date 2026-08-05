import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorContext } from "@aos/errors";

export interface EventBusExceptionOptions {
  readonly cause?: unknown;
  readonly context?: AosErrorContext;
}

/**
 * Base class for every exception raised by the Event Bus. Never thrown directly — always via
 * one of the concrete subclasses below (Constitution §16 Error Handling Standards).
 */
export class EventBusException extends AosError {
  constructor(message: string, options: EventBusExceptionOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
