import { EventCategory } from "@aos/event-bus";
import { describe, expect, it } from "vitest";

import { CapiConnectorEvents } from "../../../../src/domain/events/CapiConnectorEvents.js";
import { EventName } from "../../../../src/domain/value-objects/EventName.js";
import { createFakePublisher } from "../../../helpers/publisher.js";

const occurredAt = new Date("2026-01-01T00:00:00.000Z");

describe("CapiConnectorEvents", () => {
  it("publishEventSent publishes to aaos.capi-connector.event.sent", async () => {
    const publisher = createFakePublisher();
    const events = new CapiConnectorEvents(publisher);
    await events.publishEventSent({
      eventName: EventName.CONTACT,
      fbtraceId: "trace-1",
      tenantId: "t1",
      correlationId: "c1",
      occurredAt,
      version: "1.0",
    });
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]).toMatchObject({
      type: "aaos.capi-connector.event.sent",
      category: EventCategory.DOMAIN,
      source: "@aos/capi-connector",
      producer: "@aos/capi-connector",
      tenantId: "t1",
      correlationId: "c1",
    });
  });

  it("publishEventFailed publishes to aaos.capi-connector.event.failed", async () => {
    const publisher = createFakePublisher();
    const events = new CapiConnectorEvents(publisher);
    await events.publishEventFailed({
      eventName: EventName.PURCHASE,
      errorMessage: "network failure",
      tenantId: "t1",
      correlationId: "c1",
      occurredAt,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.capi-connector.event.failed");
  });

  it("publishBatchCompleted publishes to aaos.capi-connector.batch.completed", async () => {
    const publisher = createFakePublisher();
    const events = new CapiConnectorEvents(publisher);
    await events.publishBatchCompleted({
      batchSize: 1,
      successCount: 1,
      failureCount: 0,
      tenantId: "t1",
      correlationId: "c1",
      occurredAt,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.capi-connector.batch.completed");
  });

  it("publishEmqScoreReceived publishes to aaos.capi-connector.emq.received", async () => {
    const publisher = createFakePublisher();
    const events = new CapiConnectorEvents(publisher);
    await events.publishEmqScoreReceived({
      pixelId: "123",
      score: 8.3,
      eventsReceived: 10,
      tenantId: "t1",
      correlationId: "c1",
      occurredAt,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.capi-connector.emq.received");
  });

  it("uses a custom source when provided", async () => {
    const publisher = createFakePublisher();
    const events = new CapiConnectorEvents(publisher, "custom-source");
    await events.publishEventSent({
      eventName: EventName.CONTACT,
      tenantId: "t1",
      correlationId: "c1",
      occurredAt,
      version: "1.0",
    });
    expect(publisher.published[0]?.source).toBe("custom-source");
  });
});
