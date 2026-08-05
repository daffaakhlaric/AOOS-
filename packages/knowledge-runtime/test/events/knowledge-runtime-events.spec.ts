import { EventCategory } from "@aos/event-bus";
import { describe, expect, it } from "vitest";

import { createKnowledgeRuntimeContext } from "../../src/context/create-knowledge-runtime-context.js";
import { KnowledgeRuntimeEventType } from "../../src/events/knowledge-runtime-event-type.js";
import { KnowledgeRuntimeEvents } from "../../src/events/knowledge-runtime-events.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("Events Test — KnowledgeRuntimeEvents", () => {
  it("publishes onto the injected IPublisher with LIFECYCLE category and Context metadata", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeRuntimeEvents(publisher);
    const context = createKnowledgeRuntimeContext({ knowledgeId: "k-1", tenantId: "tenant-1" });

    await events.publishRuntimeEvent(KnowledgeRuntimeEventType.CREATED, context);

    expect(publish).toHaveBeenCalledTimes(1);
    const input = publish.mock.calls[0]?.[0];
    expect(input.type).toBe(KnowledgeRuntimeEventType.CREATED);
    expect(input.category).toBe(EventCategory.LIFECYCLE);
    expect(input.tenantId).toBe("tenant-1");
    expect(input.correlationId).toBe(context.correlationId);
  });

  it("merges extra fields into the event payload", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeRuntimeEvents(publisher);
    const context = createKnowledgeRuntimeContext({ knowledgeId: "k-1", tenantId: "tenant-1" });
    await events.publishRuntimeEvent(KnowledgeRuntimeEventType.STARTED, context, {
      fromState: "ready",
    });
    expect(publish.mock.calls[0]?.[0].payload).toMatchObject({ fromState: "ready" });
  });

  it("uses the default source 'knowledge-runtime' unless overridden", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeRuntimeEvents(publisher);
    const context = createKnowledgeRuntimeContext({ knowledgeId: "k-1", tenantId: "tenant-1" });
    await events.publishRuntimeEvent(KnowledgeRuntimeEventType.LOADED, context);
    expect(publish.mock.calls[0]?.[0].source).toBe("knowledge-runtime");
    expect(publish.mock.calls[0]?.[0].producer).toBe("@aos/knowledge-runtime");
  });

  it("accepts a custom source override", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeRuntimeEvents(publisher, "custom-source");
    const context = createKnowledgeRuntimeContext({ knowledgeId: "k-1", tenantId: "tenant-1" });
    await events.publishRuntimeEvent(KnowledgeRuntimeEventType.LOADED, context);
    expect(publish.mock.calls[0]?.[0].source).toBe("custom-source");
  });

  it("declares exactly 12 event types", () => {
    expect(Object.values(KnowledgeRuntimeEventType)).toHaveLength(12);
  });
});
