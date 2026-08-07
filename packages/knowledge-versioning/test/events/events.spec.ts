import { describe, expect, it } from "vitest";

import { KnowledgeVersionEventType } from "../../src/events/knowledge-version-event-type.js";
import { KnowledgeVersionEvents } from "../../src/events/knowledge-version-events.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("KnowledgeVersionEventType", () => {
  it("exposes exactly the 11 named event types", () => {
    expect(Object.values(KnowledgeVersionEventType)).toHaveLength(11);
  });

  it("uses the correct dotted names", () => {
    expect(KnowledgeVersionEventType.VERSION_CREATED).toBe("knowledge.version.created");
    expect(KnowledgeVersionEventType.VERSION_PUBLISHED).toBe("knowledge.version.published");
    expect(KnowledgeVersionEventType.VERSION_ARCHIVED).toBe("knowledge.version.archived");
    expect(KnowledgeVersionEventType.VERSION_RESTORED).toBe("knowledge.version.restored");
    expect(KnowledgeVersionEventType.VERSION_MERGED).toBe("knowledge.version.merged");
    expect(KnowledgeVersionEventType.VERSION_ROLLED_BACK).toBe("knowledge.version.rolledback");
    expect(KnowledgeVersionEventType.VERSION_DESTROYED).toBe("knowledge.version.destroyed");
    expect(KnowledgeVersionEventType.BRANCH_CREATED).toBe("knowledge.version.branch.created");
    expect(KnowledgeVersionEventType.SNAPSHOT_CREATED).toBe("knowledge.version.snapshot.created");
    expect(KnowledgeVersionEventType.HISTORY_RECORDED).toBe("knowledge.version.history.recorded");
    expect(KnowledgeVersionEventType.COMPARISON_COMPLETED).toBe(
      "knowledge.version.comparison.completed",
    );
  });
});

describe("KnowledgeVersionEvents", () => {
  it("publishes onto the IPublisher with context metadata and extras", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeVersionEvents(publisher);
    const context = contextFixture();
    await events.publishVersionEvent(KnowledgeVersionEventType.VERSION_CREATED, context, {
      extra: "value",
    });
    expect(publish).toHaveBeenCalledTimes(1);
    const call = publish.mock.calls[0]?.[0];
    expect(call.type).toBe(KnowledgeVersionEventType.VERSION_CREATED);
    expect(call.tenantId).toBe(context.tenantId);
    expect(call.correlationId).toBe(context.correlationId);
    expect(call.producer).toBe("@aos/knowledge-versioning");
    expect(call.payload.token).toBe(context.token);
    expect(call.payload.extra).toBe("value");
  });

  it("defaults source to knowledge-versioning and accepts an override", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeVersionEvents(publisher, "custom-source");
    await events.publishVersionEvent(KnowledgeVersionEventType.VERSION_PUBLISHED, contextFixture());
    expect(publish.mock.calls[0]?.[0].source).toBe("custom-source");
  });

  it("publishes with no extra payload fields when none supplied", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeVersionEvents(publisher);
    await events.publishVersionEvent(KnowledgeVersionEventType.VERSION_DESTROYED, contextFixture());
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
