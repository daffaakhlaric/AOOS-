import { describe, expect, it } from "vitest";

import { KnowledgeSourceEventType } from "../../src/events/knowledge-source-event-type.js";
import { KnowledgeSourceEvents } from "../../src/events/knowledge-source-events.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("KnowledgeSourceEvents additional coverage", () => {
  it("publishes every named event type without error", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeSourceEvents(publisher);
    for (const type of Object.values(KnowledgeSourceEventType)) {
      await events.publishSourceEvent(type, contextFixture());
    }
    expect(publish).toHaveBeenCalledTimes(Object.values(KnowledgeSourceEventType).length);
  });

  it("carries traceId through to the published event", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeSourceEvents(publisher);
    await events.publishSourceEvent(
      KnowledgeSourceEventType.CREATED,
      contextFixture({ traceId: "trace-1" }),
    );
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ traceId: "trace-1" }));
  });

  it("extra payload fields override the default sourceId/providerId keys when supplied", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeSourceEvents(publisher);
    await events.publishSourceEvent(KnowledgeSourceEventType.CREATED, contextFixture(), {
      sourceId: "overridden",
    });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ sourceId: "overridden" }) }),
    );
  });
});
