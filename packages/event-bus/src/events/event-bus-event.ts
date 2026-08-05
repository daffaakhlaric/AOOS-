import type { IsoDateTime } from "@aos/types";

import type { EventBusEventName } from "./event-bus-event-name.js";

export interface EventBusEventPayloadMap {
  [EventBusEventName.EVENT_PUBLISHED]: { readonly eventId: string; readonly type: string };
  [EventBusEventName.EVENT_DELIVERED]: {
    readonly eventId: string;
    readonly type: string;
    readonly subscriberId: string;
  };
  [EventBusEventName.EVENT_DROPPED]: { readonly eventId: string; readonly reason: string };
  [EventBusEventName.EVENT_RETRIED]: {
    readonly eventId: string;
    readonly subscriberId: string;
    readonly attempt: number;
  };
  [EventBusEventName.EVENT_REJECTED]: { readonly eventId: string; readonly reason: string };
  [EventBusEventName.SUBSCRIBER_ADDED]: { readonly subscriberId: string; readonly pattern: string };
  [EventBusEventName.SUBSCRIBER_REMOVED]: { readonly subscriberId: string };
  [EventBusEventName.DLQ_ENQUEUED]: { readonly eventId: string; readonly reason: string };
}

export interface EventBusEvent<TName extends EventBusEventName = EventBusEventName> {
  readonly name: TName;
  readonly payload: EventBusEventPayloadMap[TName];
  readonly emittedAt: IsoDateTime;
}
