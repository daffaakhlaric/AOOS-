import { describe, expect, it } from "vitest";

import { KnowledgeProviderEventType } from "../../src/events/knowledge-provider-event-type.js";
import { KnowledgeProviderEvents } from "../../src/events/knowledge-provider-events.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("KnowledgeProviderEventType", () => {
  it("has exactly 9 event types", () => {
    expect(Object.values(KnowledgeProviderEventType)).toHaveLength(9);
  });

  it("includes REGISTERED, CONNECTED, HEALTH_CHANGED, METRICS_UPDATED", () => {
    expect(KnowledgeProviderEventType.REGISTERED).toBe("knowledge.provider.registered");
    expect(KnowledgeProviderEventType.CONNECTED).toBe("knowledge.provider.connected");
    expect(KnowledgeProviderEventType.HEALTH_CHANGED).toBe("knowledge.provider.health.changed");
    expect(KnowledgeProviderEventType.METRICS_UPDATED).toBe("knowledge.provider.metrics.updated");
  });
});

describe("KnowledgeProviderEvents", () => {
  it("publishes an event carrying the Context's tenant/correlation identity", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeProviderEvents(publisher);
    const context = contextFixture({ tenantId: "tenant-9" });
    await events.publishProviderEvent(KnowledgeProviderEventType.REGISTERED, context);
    expect(publish).toHaveBeenCalledTimes(1);
    const call = publish.mock.calls[0]?.[0];
    expect(call.type).toBe(KnowledgeProviderEventType.REGISTERED);
    expect(call.tenantId).toBe("tenant-9");
    expect(call.correlationId).toBe(context.correlationId);
    expect(call.producer).toBe("@aos/knowledge-provider");
  });

  it("merges extra fields into the event payload", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeProviderEvents(publisher);
    await events.publishProviderEvent(KnowledgeProviderEventType.FAILED, contextFixture(), {
      reason: "boom",
    });
    const call = publish.mock.calls[0]?.[0];
    expect(call.payload.reason).toBe("boom");
  });

  it("accepts a custom source", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeProviderEvents(publisher, "custom-source");
    await events.publishProviderEvent(KnowledgeProviderEventType.DISABLED, contextFixture());
    const call = publish.mock.calls[0]?.[0];
    expect(call.source).toBe("custom-source");
  });
});
