import { describe, expect, it } from "vitest";

import { createKnowledgeIndexContext } from "../../src/context/create-knowledge-index-context.js";
import { KnowledgeIndexEventType } from "../../src/events/knowledge-index-event-type.js";
import { KnowledgeIndexEvents } from "../../src/events/knowledge-index-events.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("Events Test — edge cases", () => {
  it("publishes with an empty payload extra object by default", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeIndexEvents(publisher);
    const context = createKnowledgeIndexContext({ assetId: "a-1", tenantId: "tenant-1" });
    await events.publishIndexEvent(KnowledgeIndexEventType.OPTIMIZED, context);
    expect(publish.mock.calls[0]?.[0].payload).toMatchObject({ assetId: "a-1" });
  });

  it("carries workspaceId in the payload when the Context has one", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeIndexEvents(publisher);
    const context = createKnowledgeIndexContext({
      assetId: "a-1",
      tenantId: "tenant-1",
      workspaceId: "ws-1",
    });
    await events.publishIndexEvent(KnowledgeIndexEventType.HEALTH_CHANGED, context);
    expect(publish.mock.calls[0]?.[0].payload).toMatchObject({ workspaceId: "ws-1" });
  });
});
