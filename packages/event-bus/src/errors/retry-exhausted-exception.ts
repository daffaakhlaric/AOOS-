import { EventBusException, type EventBusExceptionOptions } from "./event-bus-exception.js";

/** Raised when a subscriber delivery has exhausted its Retry Policy's `maxAttempts`. */
export class RetryExhaustedException extends EventBusException {
  constructor(message: string, options?: EventBusExceptionOptions) {
    super(message, options);
  }
}
