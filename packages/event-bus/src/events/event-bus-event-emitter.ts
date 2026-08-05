import { EventEmitter } from "node:events";

import type { IsoDateTime } from "@aos/types";

import type { EventBusEventName } from "./event-bus-event-name.js";
import type { EventBusEvent, EventBusEventPayloadMap } from "./event-bus-event.js";

export type EventBusEventListener<TName extends EventBusEventName> = (
  event: EventBusEvent<TName>,
) => void;

/** A small, typed, in-process pub/sub for the Event Bus's own operational notifications. */
export class EventBusEventEmitter {
  private readonly emitter = new EventEmitter({ captureRejections: true });

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  emit<TName extends EventBusEventName>(
    name: TName,
    payload: EventBusEventPayloadMap[TName],
  ): void {
    const event: EventBusEvent<TName> = {
      name,
      payload,
      emittedAt: new Date().toISOString() as IsoDateTime,
    };
    this.emitter.emit(name, event);
  }

  on<TName extends EventBusEventName>(name: TName, listener: EventBusEventListener<TName>): void {
    this.emitter.on(name, listener as (...args: unknown[]) => void);
  }

  off<TName extends EventBusEventName>(name: TName, listener: EventBusEventListener<TName>): void {
    this.emitter.off(name, listener as (...args: unknown[]) => void);
  }

  once<TName extends EventBusEventName>(name: TName, listener: EventBusEventListener<TName>): void {
    this.emitter.once(name, listener as (...args: unknown[]) => void);
  }

  listenerCount(name: EventBusEventName): number {
    return this.emitter.listenerCount(name);
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
