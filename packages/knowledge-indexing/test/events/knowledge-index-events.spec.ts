import { EventCategory } from "@aos/event-bus";
import { describe, expect, it } from "vitest";

import { createKnowledgeIndexContext } from "../../src/context/create-knowledge-index-context.js";
import { KnowledgeIndexEventType } from "../../src/events/knowledge-index-event-type.js";
import { KnowledgeIndexEvents } from "../../src/events/knowledge-index-events.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("Events Test — KnowledgeIndexEvents", () => {
  it("publishes onto the injected IPublisher with LIFECYCLE category and Context metadata", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeIndexEvents(publisher);
    const context = createKnowledgeIndexContext({ assetId: "a-1", tenantId: "tenant-1" });

    await events.publishIndexEvent(KnowledgeIndexEventType.CREATED, context);

    expect(publish).toHaveBeenCalledTimes(1);
    const input = publish.mock.calls[0]?.[0];
    expect(input.type).toBe(KnowledgeIndexEventType.CREATED);
    expect(input.category).toBe(EventCategory.LIFECYCLE);
    expect(input.tenantId).toBe("tenant-1");
    expect(input.correlationId).toBe(context.correlationId);
  });

  it("merges extra fields into the event payload", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeIndexEvents(publisher);
    const context = createKnowledgeIndexContext({ assetId: "a-1", tenantId: "tenant-1" });
    await events.publishIndexEvent(KnowledgeIndexEventType.REBUILT, context, { entryCount: 3 });
    expect(publish.mock.calls[0]?.[0].payload).toMatchObject({ entryCount: 3 });
  });

  it("uses the default source 'knowledge-indexing' unless overridden", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeIndexEvents(publisher);
    const context = createKnowledgeIndexContext({ assetId: "a-1", tenantId: "tenant-1" });
    await events.publishIndexEvent(KnowledgeIndexEventType.UPDATED, context);
    expect(publish.mock.calls[0]?.[0].source).toBe("knowledge-indexing");
    expect(publish.mock.calls[0]?.[0].producer).toBe("@aos/knowledge-indexing");
  });

  it("accepts a custom source override", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeIndexEvents(publisher, "custom-source");
    const context = createKnowledgeIndexContext({ assetId: "a-1", tenantId: "tenant-1" });
    await events.publishIndexEvent(KnowledgeIndexEventType.UPDATED, context);
    expect(publish.mock.calls[0]?.[0].source).toBe("custom-source");
  });

  it("declares exactly 7 event types", () => {
    expect(Object.values(KnowledgeIndexEventType)).toHaveLength(7);
  });
});
