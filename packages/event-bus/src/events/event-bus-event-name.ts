/**
 * Internal, in-process notifications the Event Bus emits about its own operation — distinct
 * from the AOS Event Contract (contracts/base-event.ts) that flows THROUGH the bus. Mirrors
 * the precedent set by @aos/runtime-kernel's `KernelEventEmitter` and @aos/registry's
 * `RegistryEventEmitter`.
 */
export enum EventBusEventName {
  EVENT_PUBLISHED = "event_bus.event_published",
  EVENT_DELIVERED = "event_bus.event_delivered",
  EVENT_DROPPED = "event_bus.event_dropped",
  EVENT_RETRIED = "event_bus.event_retried",
  EVENT_REJECTED = "event_bus.event_rejected",
  SUBSCRIBER_ADDED = "event_bus.subscriber_added",
  SUBSCRIBER_REMOVED = "event_bus.subscriber_removed",
  DLQ_ENQUEUED = "event_bus.dlq_enqueued",
}
