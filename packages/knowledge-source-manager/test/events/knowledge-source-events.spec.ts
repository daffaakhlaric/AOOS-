import { describe, expect, it } from "vitest";

import { KnowledgeSourceEventType } from "../../src/events/knowledge-source-event-type.js";
import { KnowledgeSourceEvents } from "../../src/events/knowledge-source-events.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("KnowledgeSourceEventType", () => {
  it("has exactly the 9 events named in the prompt", () => {
    expect(Object.values(KnowledgeSourceEventType)).toEqual([
      "knowledge.source.created",
      "knowledge.source.updated",
      "knowledge.source.deleted",
      "knowledge.source.enabled",
      "knowledge.source.disabled",
      "knowledge.source.registered",
      "knowledge.source.archived",
      "knowledge.source.metrics.updated",
      "knowledge.source.health.changed",
    ]);
  });
});

describe("KnowledgeSourceEvents", () => {
  it("publishes onto the real IPublisher with Context metadata", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeSourceEvents(publisher);
    const context = contextFixture();
    await events.publishSourceEvent(KnowledgeSourceEventType.CREATED, context, { extra: 1 });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: KnowledgeSourceEventType.CREATED,
        tenantId: context.tenantId,
        correlationId: context.correlationId,
        producer: "@aos/knowledge-source-manager",
        payload: expect.objectContaining({ sourceId: context.sourceId, extra: 1 }),
      }),
    );
  });

  it("defaults source to knowledge-source-manager", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeSourceEvents(publisher);
    await events.publishSourceEvent(KnowledgeSourceEventType.CREATED, contextFixture());
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ source: "knowledge-source-manager" }),
    );
  });

  it("accepts a custom source name", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeSourceEvents(publisher, "custom-source");
    await events.publishSourceEvent(KnowledgeSourceEventType.CREATED, contextFixture());
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ source: "custom-source" }));
  });
});
