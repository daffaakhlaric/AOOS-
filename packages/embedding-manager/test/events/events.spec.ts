import { describe, expect, it } from "vitest";

import { EmbeddingEvents } from "../../src/events/embedding-events.js";
import { EmbeddingManagerEventType } from "../../src/events/embedding-manager-event-type.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/event-publisher-fixture.js";

describe("EmbeddingManagerEventType", () => {
  it("has exactly the 11 documented events", () => {
    expect(Object.values(EmbeddingManagerEventType)).toHaveLength(11);
  });

  it("uses the embedding.* namespace (not knowledge.embedding.*)", () => {
    for (const type of Object.values(EmbeddingManagerEventType)) {
      expect(type.startsWith("embedding.")).toBe(true);
      expect(type.startsWith("knowledge.")).toBe(false);
    }
  });
});

describe("EmbeddingEvents", () => {
  it("publishes onto the real IPublisher with producer @aos/embedding-manager", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new EmbeddingEvents(publisher);
    await events.publishEmbeddingEvent(
      EmbeddingManagerEventType.EMBEDDING_CREATED,
      contextFixture(),
    );
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0]![0]).toMatchObject({
      type: EmbeddingManagerEventType.EMBEDDING_CREATED,
      producer: "@aos/embedding-manager",
    });
  });

  it("includes token/embeddingId/tenantId/correlationId in the payload envelope", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new EmbeddingEvents(publisher);
    const context = contextFixture({ embeddingId: "e-42" });
    await events.publishEmbeddingEvent(EmbeddingManagerEventType.EMBEDDING_QUEUED, context);
    const call = publish.mock.calls[0]![0];
    expect(call.payload.embeddingId).toBe("e-42");
    expect(call.tenantId).toBe(context.tenantId);
    expect(call.correlationId).toBe(context.correlationId);
  });

  it("merges extra payload fields", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new EmbeddingEvents(publisher);
    await events.publishEmbeddingEvent(
      EmbeddingManagerEventType.PROVIDER_REGISTERED,
      contextFixture(),
      {
        providerId: "p-1",
      },
    );
    expect(publish.mock.calls[0]![0].payload.providerId).toBe("p-1");
  });

  it("defaults source to embedding-manager", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new EmbeddingEvents(publisher);
    await events.publishEmbeddingEvent(
      EmbeddingManagerEventType.MODEL_REGISTERED,
      contextFixture(),
    );
    expect(publish.mock.calls[0]![0].source).toBe("embedding-manager");
  });
});
