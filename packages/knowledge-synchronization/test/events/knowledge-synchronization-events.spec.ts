import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationEventType } from "../../src/events/knowledge-synchronization-event-type.js";
import { KnowledgeSynchronizationEvents } from "../../src/events/knowledge-synchronization-events.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("KnowledgeSynchronizationEventType", () => {
  it("has exactly 10 event types", () => {
    expect(Object.values(KnowledgeSynchronizationEventType)).toHaveLength(10);
  });

  it("includes CREATED, COMPLETED, HEALTH_CHANGED, METRICS_UPDATED", () => {
    expect(KnowledgeSynchronizationEventType.CREATED).toBe("knowledge.sync.created");
    expect(KnowledgeSynchronizationEventType.COMPLETED).toBe("knowledge.sync.completed");
    expect(KnowledgeSynchronizationEventType.HEALTH_CHANGED).toBe("knowledge.sync.health.changed");
    expect(KnowledgeSynchronizationEventType.METRICS_UPDATED).toBe(
      "knowledge.sync.metrics.updated",
    );
  });
});

describe("KnowledgeSynchronizationEvents", () => {
  it("publishes an event carrying the Context's tenant/correlation identity", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeSynchronizationEvents(publisher);
    const context = contextFixture({ tenantId: "tenant-9" });
    await events.publishSynchronizationEvent(KnowledgeSynchronizationEventType.STARTED, context);
    expect(publish).toHaveBeenCalledTimes(1);
    const call = publish.mock.calls[0]?.[0];
    expect(call.type).toBe(KnowledgeSynchronizationEventType.STARTED);
    expect(call.tenantId).toBe("tenant-9");
    expect(call.correlationId).toBe(context.correlationId);
    expect(call.producer).toBe("@aos/knowledge-synchronization");
  });

  it("merges extra fields into the event payload", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeSynchronizationEvents(publisher);
    await events.publishSynchronizationEvent(
      KnowledgeSynchronizationEventType.FAILED,
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
    const events = new KnowledgeSynchronizationEvents(publisher, "custom-source");
    await events.publishSynchronizationEvent(
      KnowledgeSynchronizationEventType.CANCELLED,
      contextFixture(),
    );
    const call = publish.mock.calls[0]?.[0];
    expect(call.source).toBe("custom-source");
  });
});
