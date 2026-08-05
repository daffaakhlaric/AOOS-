import { describe, expect, it } from "vitest";

import { KnowledgeRetrievalEventType } from "../../src/events/knowledge-retrieval-event-type.js";
import { KnowledgeRetrievalEvents } from "../../src/events/knowledge-retrieval-events.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("KnowledgeRetrievalEventType", () => {
  it("has exactly 8 event types", () => {
    expect(Object.values(KnowledgeRetrievalEventType)).toHaveLength(8);
  });

  it("includes SEARCH_STARTED, SEARCH_COMPLETED, HEALTH_CHANGED, METRICS_UPDATED", () => {
    expect(KnowledgeRetrievalEventType.SEARCH_STARTED).toBe("knowledge.search.started");
    expect(KnowledgeRetrievalEventType.SEARCH_COMPLETED).toBe("knowledge.search.completed");
    expect(KnowledgeRetrievalEventType.HEALTH_CHANGED).toBe("knowledge.search.health.changed");
    expect(KnowledgeRetrievalEventType.METRICS_UPDATED).toBe("knowledge.search.metrics.updated");
  });
});

describe("KnowledgeRetrievalEvents", () => {
  it("publishes an event carrying the Context's tenant/correlation identity", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeRetrievalEvents(publisher);
    const context = contextFixture({ tenantId: "tenant-9" });
    await events.publishRetrievalEvent(KnowledgeRetrievalEventType.SEARCH_STARTED, context);
    expect(publish).toHaveBeenCalledTimes(1);
    const call = publish.mock.calls[0]?.[0];
    expect(call.type).toBe(KnowledgeRetrievalEventType.SEARCH_STARTED);
    expect(call.tenantId).toBe("tenant-9");
    expect(call.correlationId).toBe(context.correlationId);
    expect(call.producer).toBe("@aos/knowledge-retrieval");
  });

  it("merges extra fields into the event payload", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeRetrievalEvents(publisher);
    await events.publishRetrievalEvent(
      KnowledgeRetrievalEventType.SEARCH_FAILED,
      contextFixture(),
      {
        reason: "boom",
      },
    );
    const call = publish.mock.calls[0]?.[0];
    expect(call.payload.reason).toBe("boom");
  });

  it("accepts a custom source", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeRetrievalEvents(publisher, "custom-source");
    await events.publishRetrievalEvent(
      KnowledgeRetrievalEventType.SEARCH_CANCELLED,
      contextFixture(),
    );
    const call = publish.mock.calls[0]?.[0];
    expect(call.source).toBe("custom-source");
  });
});
