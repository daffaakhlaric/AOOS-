import { describe, expect, it } from "vitest";

import { NoOpEventPublisher } from "../../src/events/no-op-event-publisher.js";

describe("NoOpEventPublisher", () => {
  it("does not throw when publishing", () => {
    const publisher = new NoOpEventPublisher();
    expect(() => publisher.publish("anything", { a: 1 })).not.toThrow();
  });

  it("returns undefined from publish", () => {
    const publisher = new NoOpEventPublisher();
    expect(publisher.publish("x", {})).toBeUndefined();
  });

  it("discards multiple publishes silently", () => {
    const publisher = new NoOpEventPublisher();
    publisher.publish("a", {});
    publisher.publish("b", {});
    expect(true).toBe(true);
  });
});
