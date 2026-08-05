import { EventBusException, type EventBusExceptionOptions } from "./event-bus-exception.js";

/** Raised when Publish/PublishAsync/PublishBatch cannot accept an event. */
export class PublishException extends EventBusException {
  constructor(message: string, options?: EventBusExceptionOptions) {
    super(message, options);
  }
}
