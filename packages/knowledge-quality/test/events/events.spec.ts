import { describe, expect, it } from "vitest";

import { KnowledgeQualityEventType } from "../../src/events/knowledge-quality-event-type.js";
import { KnowledgeQualityEvents } from "../../src/events/knowledge-quality-events.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/event-publisher-fixture.js";

describe("KnowledgeQualityEventType", () => {
  it("has exactly 10 events", () => {
    expect(Object.values(KnowledgeQualityEventType)).toHaveLength(10);
  });

  it("uses dotted event names under the knowledge.quality. namespace", () => {
    for (const type of Object.values(KnowledgeQualityEventType)) {
      expect(type.startsWith("knowledge.quality.")).toBe(true);
    }
  });
});

describe("KnowledgeQualityEvents", () => {
  it("publishes onto the real IPublisher with the expected producer", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeQualityEvents(publisher);
    const context = contextFixture();
    await events.publishQualityEvent(KnowledgeQualityEventType.ASSESSMENT_CREATED, context);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: KnowledgeQualityEventType.ASSESSMENT_CREATED,
        producer: "@aos/knowledge-quality",
        tenantId: context.tenantId,
      }),
    );
  });

  it("merges extra payload fields", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeQualityEvents(publisher);
    const context = contextFixture();
    await events.publishQualityEvent(KnowledgeQualityEventType.ASSESSMENT_FAILED, context, {
      reason: "boom",
    });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ reason: "boom", token: context.token }),
      }),
    );
  });

  it.each(Object.values(KnowledgeQualityEventType))("publishes %s", async (type) => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeQualityEvents(publisher);
    await events.publishQualityEvent(type, contextFixture());
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
