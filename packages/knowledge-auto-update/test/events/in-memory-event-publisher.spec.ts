import { describe, expect, it, vi } from "vitest";

import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { ManualClock } from "../../src/utils/clock.js";

describe("InMemoryEventPublisher", () => {
  it("invokes registered handlers on publish", () => {
    const publisher = new InMemoryEventPublisher();
    const handler = vi.fn();
    publisher.on("foo", handler);
    publisher.publish("foo", { a: 1 });
    expect(handler).toHaveBeenCalledWith({ a: 1 });
  });

  it("does not invoke handlers for other event types", () => {
    const publisher = new InMemoryEventPublisher();
    const handler = vi.fn();
    publisher.on("foo", handler);
    publisher.publish("bar", {});
    expect(handler).not.toHaveBeenCalled();
  });

  it("supports multiple handlers for the same event", () => {
    const publisher = new InMemoryEventPublisher();
    const a = vi.fn();
    const b = vi.fn();
    publisher.on("foo", a);
    publisher.on("foo", b);
    publisher.publish("foo", {});
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes via the returned function", () => {
    const publisher = new InMemoryEventPublisher();
    const handler = vi.fn();
    const unsubscribe = publisher.on("foo", handler);
    unsubscribe();
    publisher.publish("foo", {});
    expect(handler).not.toHaveBeenCalled();
  });

  it("records published events in history with the clock's timestamp", () => {
    const clock = new ManualClock(1000);
    const publisher = new InMemoryEventPublisher(clock);
    publisher.publish("foo", { x: 1 });
    expect(publisher.getHistory()).toEqual([
      { eventType: "foo", payload: { x: 1 }, publishedAt: 1000 },
    ]);
  });

  it("accumulates multiple history entries in order", () => {
    const publisher = new InMemoryEventPublisher();
    publisher.publish("a", {});
    publisher.publish("b", {});
    expect(publisher.getHistory().map((e) => e.eventType)).toEqual(["a", "b"]);
  });

  it("clears history via clearHistory", () => {
    const publisher = new InMemoryEventPublisher();
    publisher.publish("a", {});
    publisher.clearHistory();
    expect(publisher.getHistory()).toHaveLength(0);
  });

  it("handles publishing with no registered handlers", () => {
    const publisher = new InMemoryEventPublisher();
    expect(() => publisher.publish("nobody-listening", {})).not.toThrow();
  });

  it("uses SystemClock by default when no clock is supplied", () => {
    const publisher = new InMemoryEventPublisher();
    const before = Date.now();
    publisher.publish("x", {});
    const [entry] = publisher.getHistory();
    expect(entry!.publishedAt).toBeGreaterThanOrEqual(before);
  });
});
