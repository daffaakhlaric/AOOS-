import { describe, expect, it } from "vitest";

import { KnowledgeGeneratorEventType } from "../../src/events/knowledge-generator-event-type.js";
import { KnowledgeGeneratorEvents } from "../../src/events/knowledge-generator-events.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/event-publisher-fixture.js";

describe("KnowledgeGeneratorEventType", () => {
  it("has exactly 8 events", () => {
    expect(Object.values(KnowledgeGeneratorEventType)).toHaveLength(8);
  });

  it("uses dotted event names under the knowledge.generation. namespace", () => {
    for (const type of Object.values(KnowledgeGeneratorEventType)) {
      expect(type.startsWith("knowledge.generation.")).toBe(true);
    }
  });
});

describe("KnowledgeGeneratorEvents", () => {
  it("publishes onto the real IPublisher with the expected producer", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeGeneratorEvents(publisher);
    const context = contextFixture();
    await events.publishGeneratorEvent(KnowledgeGeneratorEventType.GENERATION_CREATED, context);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: KnowledgeGeneratorEventType.GENERATION_CREATED,
        producer: "@aos/knowledge-generator",
        tenantId: context.tenantId,
      }),
    );
  });

  it("merges extra payload fields", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeGeneratorEvents(publisher);
    const context = contextFixture();
    await events.publishGeneratorEvent(KnowledgeGeneratorEventType.GENERATION_FAILED, context, {
      reason: "boom",
    });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ reason: "boom", token: context.token }),
      }),
    );
  });

  it.each(Object.values(KnowledgeGeneratorEventType))("publishes %s", async (type) => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeGeneratorEvents(publisher);
    await events.publishGeneratorEvent(type, contextFixture());
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
