import { describe, expect, it } from "vitest";

import { EmbeddingEvents } from "../../src/events/embedding-events.js";
import { EmbeddingManagerEventType } from "../../src/events/embedding-manager-event-type.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/event-publisher-fixture.js";

describe("EmbeddingEvents — every documented event type publishes correctly", () => {
  it.each(Object.values(EmbeddingManagerEventType))(
    "publishes %s with category LIFECYCLE",
    async (type) => {
      const { publisher, publish } = fakePublisher();
      const events = new EmbeddingEvents(publisher);
      await events.publishEmbeddingEvent(type, contextFixture());
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({ type, category: "lifecycle" }),
      );
    },
  );

  it("EmbeddingManagerEventType has no duplicate values", () => {
    const values = Object.values(EmbeddingManagerEventType);
    expect(new Set(values).size).toBe(values.length);
  });

  it("event dotted names all start with the embedding domain segment", () => {
    for (const type of Object.values(EmbeddingManagerEventType)) {
      expect(type.split(".")[0]).toBe("embedding");
    }
  });
});
