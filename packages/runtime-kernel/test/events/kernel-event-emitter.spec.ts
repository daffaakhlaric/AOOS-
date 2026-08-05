import type { IsoDateTime } from "@aos/types";
import { describe, expect, it, vi } from "vitest";

import { KernelEventEmitter } from "../../src/events/kernel-event-emitter.js";
import { KernelEventName } from "../../src/types/index.js";

describe("KernelEventEmitter", () => {
  it("delivers an emitted event to a registered listener with a timestamp", () => {
    const emitter = new KernelEventEmitter();
    const listener = vi.fn();
    emitter.on(KernelEventName.KERNEL_STARTED, listener);

    emitter.emit(KernelEventName.KERNEL_STARTED, {
      startedAt: new Date().toISOString() as IsoDateTime,
    });

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]![0];
    expect(event.name).toBe(KernelEventName.KERNEL_STARTED);
    expect(typeof event.emittedAt).toBe("string");
  });

  it("off() removes a listener so it no longer receives events", () => {
    const emitter = new KernelEventEmitter();
    const listener = vi.fn();
    emitter.on(KernelEventName.KERNEL_STOPPED, listener);
    emitter.off(KernelEventName.KERNEL_STOPPED, listener);

    emitter.emit(KernelEventName.KERNEL_STOPPED, {
      stoppedAt: new Date().toISOString() as IsoDateTime,
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it("once() fires only for the first matching event", () => {
    const emitter = new KernelEventEmitter();
    const listener = vi.fn();
    emitter.once(KernelEventName.MODULE_LOADED, listener);

    emitter.emit(KernelEventName.MODULE_LOADED, { name: "m1", version: "1.0.0" });
    emitter.emit(KernelEventName.MODULE_LOADED, { name: "m2", version: "1.0.0" });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("listenerCount reflects the number of active listeners for a given event", () => {
    const emitter = new KernelEventEmitter();
    expect(emitter.listenerCount(KernelEventName.PLUGIN_LOADED)).toBe(0);
    emitter.on(KernelEventName.PLUGIN_LOADED, () => undefined);
    expect(emitter.listenerCount(KernelEventName.PLUGIN_LOADED)).toBe(1);
  });

  it("removeAllListeners() clears every registration", () => {
    const emitter = new KernelEventEmitter();
    const listener = vi.fn();
    emitter.on(KernelEventName.HEALTH_CHANGED, listener);
    emitter.removeAllListeners();
    emitter.emit(KernelEventName.HEALTH_CHANGED, { status: "healthy" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("supports more than the default 10 listeners without warning (setMaxListeners(0))", () => {
    const emitter = new KernelEventEmitter();
    for (let i = 0; i < 15; i += 1) {
      emitter.on(KernelEventName.KERNEL_RELOADED, () => undefined);
    }
    expect(emitter.listenerCount(KernelEventName.KERNEL_RELOADED)).toBe(15);
  });
});
