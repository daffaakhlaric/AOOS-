import { describe, expect, it } from "vitest";

import { createKnowledgeSourceContext } from "../../src/context/create-knowledge-source-context.js";
import { KnowledgeSourceState } from "../../src/domain/knowledge-source-state.js";
import { IllegalSourceTransitionException } from "../../src/errors/illegal-source-transition-exception.js";
import { KnowledgeSourceEvents } from "../../src/events/knowledge-source-events.js";
import { KnowledgeSourceManager } from "../../src/manager/knowledge-source-manager.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

function buildManager() {
  const { publisher } = fakePublisher();
  return new KnowledgeSourceManager({ events: new KnowledgeSourceEvents(publisher) });
}

describe("KnowledgeSourceManager additional coverage", () => {
  it("rejects enabling an already-Enabled Source directly to Enabled again", async () => {
    const manager = buildManager();
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    const created = await manager.create(
      metadataFixture(),
      configurationFixture({ enabled: true }),
      context,
    );
    await expect(manager.enable(created.token)).rejects.toThrow(IllegalSourceTransitionException);
  });

  it("archive() then re-enable() moves an Archived Source back to Enabled", async () => {
    const manager = buildManager();
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    const created = await manager.create(
      metadataFixture(),
      configurationFixture({ enabled: true }),
      context,
    );
    await manager.archive(created.token);
    const reEnabled = await manager.enable(created.token);
    expect(reEnabled.state).toBe(KnowledgeSourceState.ENABLED);
  });

  it("remove() on a Disabled Source succeeds", async () => {
    const manager = buildManager();
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    const created = await manager.create(
      metadataFixture(),
      configurationFixture({ enabled: true }),
      context,
    );
    await manager.disable(created.token);
    const removed = await manager.remove(created.token);
    expect(removed.state).toBe(KnowledgeSourceState.DESTROYED);
  });

  it("resolver reflects Sources registered through the Manager", async () => {
    const manager = buildManager();
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    await manager.create(metadataFixture(), configurationFixture(), context);
    expect(manager.resolver.resolveById("source-1").sourceId).toBe("source-1");
  });

  it("list() with no Sources returns an empty array", () => {
    const manager = buildManager();
    expect(manager.list()).toEqual([]);
    expect(manager.count()).toBe(0);
  });

  it("session is exposed and independently usable", () => {
    const manager = buildManager();
    const record = manager.session.open("tok-x", "holder-x");
    expect(record.state).toBe("open");
  });
});
