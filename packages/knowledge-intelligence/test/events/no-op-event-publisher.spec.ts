import { describe, expect, it } from "vitest";

import { NoOpEventPublisher } from "../../src/events/no-op-event-publisher.js";

describe("NoOpEventPublisher", () => {
  it("discards published events without throwing", () => {
    const publisher = new NoOpEventPublisher();
    expect(() => publisher.publish("test.event", { a: 1 })).not.toThrow();
  });
});
