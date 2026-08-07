import { describe, expect, it } from "vitest";

import { NoOpEventPublisher } from "../../src/events/no-op-event-publisher.js";

describe("NoOpEventPublisher", () => {
  it("does not throw when publishing", () => {
    const publisher = new NoOpEventPublisher();
    expect(() => publisher.publish("evt.a", { key: "value" })).not.toThrow();
  });

  it("returns undefined from publish", () => {
    const publisher = new NoOpEventPublisher();
    expect(publisher.publish("evt.a", {})).toBeUndefined();
  });
});
