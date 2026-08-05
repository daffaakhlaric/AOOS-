import { EventBusException, type EventBusExceptionOptions } from "./event-bus-exception.js";

/** Raised when an event cannot be routed (e.g. malformed pattern subscription). */
export class RoutingException extends EventBusException {
  constructor(message: string, options?: EventBusExceptionOptions) {
    super(message, options);
  }
}
