import { describe, expect, it, vi } from "vitest";

import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";

describe("InMemoryEventPublisher additional coverage", () => {
  it("preserves publish order in history", () => {
    const publisher = new InMemoryEventPublisher();
    publisher.publish("a", {});
    publisher.publish("b", {});
    publisher.publish("c", {});
    expect(publisher.getHistory().map((e) => e.eventType)).toEqual(["a", "b", "c"]);
  });

  it("invokes handlers in the order they were registered", () => {
    const publisher = new InMemoryEventPublisher();
    const order: string[] = [];
    publisher.on("evt", () => order.push("first"));
    publisher.on("evt", () => order.push("second"));
    publisher.publish("evt", {});
    expect(order).toEqual(["first", "second"]);
  });

  it("unsubscribing one handler does not affect others for the same event", () => {
    const publisher = new InMemoryEventPublisher();
    const first = vi.fn();
    const second = vi.fn();
    const unsubFirst = publisher.on("evt", first);
    publisher.on("evt", second);
    unsubFirst();
    publisher.publish("evt", {});
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it("re-publishing after clearHistory only records events published afterward", () => {
    const publisher = new InMemoryEventPublisher();
    publisher.publish("a", {});
    publisher.clearHistory();
    publisher.publish("b", {});
    expect(publisher.getHistory()).toHaveLength(1);
    expect(publisher.getHistory()[0]!.eventType).toBe("b");
  });

  it("passes the exact payload object reference to handlers", () => {
    const publisher = new InMemoryEventPublisher();
    const payload = { x: 1 };
    let received: unknown;
    publisher.on("evt", (p) => {
      received = p;
    });
    publisher.publish("evt", payload);
    expect(received).toBe(payload);
  });
});
