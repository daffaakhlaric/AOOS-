import { EventBusException, type EventBusExceptionOptions } from "./event-bus-exception.js";

/** Raised when an event fails Schema/Version/Payload/Tenant validation. */
export class ValidationException extends EventBusException {
  constructor(message: string, options?: EventBusExceptionOptions) {
    super(message, options);
  }
}
