import { EventEmitter } from "node:events";

import type { IsoDateTime } from "@aos/types";

import type { KernelEventName } from "../types/index.js";

import type { KernelEvent, KernelEventPayloadMap } from "./kernel-event.js";

export type KernelEventListener<TName extends KernelEventName> = (
  event: KernelEvent<TName>,
) => void;

/** A small, typed, in-process pub/sub for Kernel lifecycle notifications. See kernel-event.ts's note on scope. */
export class KernelEventEmitter {
  private readonly emitter = new EventEmitter({ captureRejections: true });

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  emit<TName extends KernelEventName>(name: TName, payload: KernelEventPayloadMap[TName]): void {
    const event: KernelEvent<TName> = {
      name,
      payload,
      emittedAt: new Date().toISOString() as IsoDateTime,
    };
    this.emitter.emit(name, event);
  }

  on<TName extends KernelEventName>(name: TName, listener: KernelEventListener<TName>): void {
    this.emitter.on(name, listener as (...args: unknown[]) => void);
  }

  off<TName extends KernelEventName>(name: TName, listener: KernelEventListener<TName>): void {
    this.emitter.off(name, listener as (...args: unknown[]) => void);
  }

  once<TName extends KernelEventName>(name: TName, listener: KernelEventListener<TName>): void {
    this.emitter.once(name, listener as (...args: unknown[]) => void);
  }

  listenerCount(name: KernelEventName): number {
    return this.emitter.listenerCount(name);
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
