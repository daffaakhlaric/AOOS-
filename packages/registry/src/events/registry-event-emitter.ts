import { EventEmitter } from "node:events";

import type { IsoDateTime } from "@aos/types";

import type { RegistryEventName } from "./registry-event-name.js";
import type { RegistryEvent, RegistryEventPayloadMap } from "./registry-event.js";

export type RegistryEventListener<TName extends RegistryEventName> = (
  event: RegistryEvent<TName>,
) => void;

/** A small, typed, in-process pub/sub for Registry System notifications — not a distributed Event Bus (Engineering Task 005.4). */
export class RegistryEventEmitter {
  private readonly emitter = new EventEmitter({ captureRejections: true });

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  emit<TName extends RegistryEventName>(
    name: TName,
    payload: RegistryEventPayloadMap[TName],
  ): void {
    const event: RegistryEvent<TName> = {
      name,
      payload,
      emittedAt: new Date().toISOString() as IsoDateTime,
    };
    this.emitter.emit(name, event);
  }

  on<TName extends RegistryEventName>(name: TName, listener: RegistryEventListener<TName>): void {
    this.emitter.on(name, listener as (...args: unknown[]) => void);
  }

  off<TName extends RegistryEventName>(name: TName, listener: RegistryEventListener<TName>): void {
    this.emitter.off(name, listener as (...args: unknown[]) => void);
  }

  listenerCount(name: RegistryEventName): number {
    return this.emitter.listenerCount(name);
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
