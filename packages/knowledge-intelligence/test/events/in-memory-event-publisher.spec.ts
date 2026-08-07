import { describe, expect, it, vi } from "vitest";

import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { ManualClock } from "../../src/utils/clock.js";

describe("InMemoryEventPublisher", () => {
  it("records every published event with a timestamp from the injected clock", () => {
    const clock = new ManualClock(1000);
    const publisher = new InMemoryEventPublisher(clock);
    publisher.publish("test.event", { a: 1 });
    expect(publisher.getHistory()).toEqual([
      { eventType: "test.event", payload: { a: 1 }, publishedAt: 1000 },
    ]);
  });

  it("invokes registered handlers for the matching event type", () => {
    const publisher = new InMemoryEventPublisher();
    const handler = vi.fn();
    publisher.on("test.event", handler);
    publisher.publish("test.event", { x: 1 });
    expect(handler).toHaveBeenCalledWith({ x: 1 });
  });

  it("does not invoke handlers registered for a different event type", () => {
    const publisher = new InMemoryEventPublisher();
    const handler = vi.fn();
    publisher.on("other.event", handler);
    publisher.publish("test.event", {});
    expect(handler).not.toHaveBeenCalled();
  });

  it("unsubscribes a handler via the returned function", () => {
    const publisher = new InMemoryEventPublisher();
    const handler = vi.fn();
    const unsubscribe = publisher.on("test.event", handler);
    unsubscribe();
    publisher.publish("test.event", {});
    expect(handler).not.toHaveBeenCalled();
  });

  it("supports multiple handlers for the same event type", () => {
    const publisher = new InMemoryEventPublisher();
    const first = vi.fn();
    const second = vi.fn();
    publisher.on("test.event", first);
    publisher.on("test.event", second);
    publisher.publish("test.event", {});
    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it("defaults to a SystemClock when none is injected", () => {
    const publisher = new InMemoryEventPublisher();
    publisher.publish("test.event", {});
    expect(publisher.getHistory()[0]!.publishedAt).toBeGreaterThan(0);
  });

  it("clears the history buffer", () => {
    const publisher = new InMemoryEventPublisher();
    publisher.publish("test.event", {});
    publisher.clearHistory();
    expect(publisher.getHistory()).toHaveLength(0);
  });
});
