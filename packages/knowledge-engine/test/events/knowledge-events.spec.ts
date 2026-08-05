import { EventCategory } from "@aos/event-bus";
import { describe, expect, it } from "vitest";

import { KnowledgeEventType } from "../../src/events/knowledge-event-type.js";
import { KnowledgeEvents } from "../../src/events/knowledge-events.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("Events Test — KnowledgeEvents", () => {
  it("publishes onto the injected IPublisher with LIFECYCLE category and Context metadata", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeEvents(publisher);
    const context = contextFixture({ tenantId: "tenant-1" });

    await events.publishKnowledgeEvent(KnowledgeEventType.CREATED, context);

    expect(publish).toHaveBeenCalledTimes(1);
    const input = publish.mock.calls[0]?.[0];
    expect(input.type).toBe(KnowledgeEventType.CREATED);
    expect(input.category).toBe(EventCategory.LIFECYCLE);
    expect(input.tenantId).toBe("tenant-1");
    expect(input.correlationId).toBe(context.correlationId);
  });

  it("merges extra fields into the event payload", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeEvents(publisher);
    await events.publishKnowledgeEvent(KnowledgeEventType.VERSION_CREATED, contextFixture(), {
      assetId: "a-1",
      versionLabel: "1.1.0",
    });
    expect(publish.mock.calls[0]?.[0].payload).toMatchObject({
      assetId: "a-1",
      versionLabel: "1.1.0",
    });
  });

  it("uses the default source 'knowledge-engine' unless overridden", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeEvents(publisher);
    await events.publishKnowledgeEvent(KnowledgeEventType.UPDATED, contextFixture());
    expect(publish.mock.calls[0]?.[0].source).toBe("knowledge-engine");
    expect(publish.mock.calls[0]?.[0].producer).toBe("@aos/knowledge-engine");
  });

  it("accepts a custom source override", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeEvents(publisher, "custom-source");
    await events.publishKnowledgeEvent(KnowledgeEventType.UPDATED, contextFixture());
    expect(publish.mock.calls[0]?.[0].source).toBe("custom-source");
  });

  it("declares exactly 11 event types", () => {
    expect(Object.values(KnowledgeEventType)).toHaveLength(11);
  });
});
