import { describe, expect, it, vi } from "vitest";

import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { createFixedClock } from "../../src/utils/clock.js";

describe("InMemoryEventPublisher", () => {
  it("invokes registered handlers for the published event type", () => {
    const publisher = new InMemoryEventPublisher();
    const handler = vi.fn();
    publisher.on("evt.a", handler);
    publisher.publish("evt.a", { key: "value" });
    expect(handler).toHaveBeenCalledWith({ key: "value" });
  });

  it("does not invoke handlers registered for a different event type", () => {
    const publisher = new InMemoryEventPublisher();
    const handler = vi.fn();
    publisher.on("evt.a", handler);
    publisher.publish("evt.b", {});
    expect(handler).not.toHaveBeenCalled();
  });

  it("supports multiple handlers for the same event type", () => {
    const publisher = new InMemoryEventPublisher();
    const first = vi.fn();
    const second = vi.fn();
    publisher.on("evt.a", first);
    publisher.on("evt.a", second);
    publisher.publish("evt.a", {});
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes via the returned function", () => {
    const publisher = new InMemoryEventPublisher();
    const handler = vi.fn();
    const unsubscribe = publisher.on("evt.a", handler);
    unsubscribe();
    publisher.publish("evt.a", {});
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not throw when publishing with no registered handlers", () => {
    const publisher = new InMemoryEventPublisher();
    expect(() => publisher.publish("evt.a", {})).not.toThrow();
  });

  it("records every published event in history", () => {
    const publisher = new InMemoryEventPublisher();
    publisher.publish("evt.a", { x: 1 });
    publisher.publish("evt.b", { y: 2 });
    expect(publisher.getHistory()).toHaveLength(2);
    expect(publisher.getHistory()[0]).toMatchObject({ eventType: "evt.a", payload: { x: 1 } });
  });

  it("uses the injected clock for publishedAt", () => {
    const publisher = new InMemoryEventPublisher(createFixedClock(12345));
    publisher.publish("evt.a", {});
    expect(publisher.getHistory()[0]!.publishedAt).toBe(12345);
  });

  it("clears history via clearHistory", () => {
    const publisher = new InMemoryEventPublisher();
    publisher.publish("evt.a", {});
    publisher.clearHistory();
    expect(publisher.getHistory()).toHaveLength(0);
  });

  it("allows unsubscribing an event type with no handlers registered without throwing", () => {
    const publisher = new InMemoryEventPublisher();
    // .on() was never called for "evt.unregistered"; publish should just no-op safely.
    expect(() => publisher.publish("evt.unregistered", {})).not.toThrow();
  });
});
