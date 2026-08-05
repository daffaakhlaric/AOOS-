import { describe, expect, it, vi } from "vitest";

import { EventBusEventEmitter } from "../../src/events/event-bus-event-emitter.js";
import { EventBusEventName } from "../../src/events/event-bus-event-name.js";

describe("EventBusEventEmitter", () => {
  it("delivers an emitted event to a listener with name/payload/emittedAt", () => {
    const emitter = new EventBusEventEmitter();
    const listener = vi.fn();
    emitter.on(EventBusEventName.EVENT_PUBLISHED, listener);
    emitter.emit(EventBusEventName.EVENT_PUBLISHED, { eventId: "e-1", type: "agent.created" });
    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]![0];
    expect(event.name).toBe(EventBusEventName.EVENT_PUBLISHED);
    expect(event.payload).toEqual({ eventId: "e-1", type: "agent.created" });
    expect(typeof event.emittedAt).toBe("string");
  });

  it("off() removes a listener", () => {
    const emitter = new EventBusEventEmitter();
    const listener = vi.fn();
    emitter.on(EventBusEventName.SUBSCRIBER_ADDED, listener);
    emitter.off(EventBusEventName.SUBSCRIBER_ADDED, listener);
    emitter.emit(EventBusEventName.SUBSCRIBER_ADDED, { subscriberId: "s-1", pattern: "*" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("once() fires only once", () => {
    const emitter = new EventBusEventEmitter();
    const listener = vi.fn();
    emitter.once(EventBusEventName.SUBSCRIBER_REMOVED, listener);
    emitter.emit(EventBusEventName.SUBSCRIBER_REMOVED, { subscriberId: "s-1" });
    emitter.emit(EventBusEventName.SUBSCRIBER_REMOVED, { subscriberId: "s-1" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("listenerCount reflects active listeners", () => {
    const emitter = new EventBusEventEmitter();
    expect(emitter.listenerCount(EventBusEventName.DLQ_ENQUEUED)).toBe(0);
    emitter.on(EventBusEventName.DLQ_ENQUEUED, vi.fn());
    expect(emitter.listenerCount(EventBusEventName.DLQ_ENQUEUED)).toBe(1);
  });

  it("removeAllListeners clears every registered listener", () => {
    const emitter = new EventBusEventEmitter();
    emitter.on(EventBusEventName.EVENT_DROPPED, vi.fn());
    emitter.removeAllListeners();
    expect(emitter.listenerCount(EventBusEventName.EVENT_DROPPED)).toBe(0);
  });
});
