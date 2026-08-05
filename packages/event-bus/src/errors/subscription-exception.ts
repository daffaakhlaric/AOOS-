import { EventBusException, type EventBusExceptionOptions } from "./event-bus-exception.js";

/** Raised for an invalid Subscribe/Unsubscribe call (e.g. unsubscribing an unknown subscription id). */
export class SubscriptionException extends EventBusException {
  constructor(message: string, options?: EventBusExceptionOptions) {
    super(message, options);
  }
}
