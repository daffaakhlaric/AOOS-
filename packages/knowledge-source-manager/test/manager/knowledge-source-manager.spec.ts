import { describe, expect, it } from "vitest";

import { createKnowledgeSourceContext } from "../../src/context/create-knowledge-source-context.js";
import { KnowledgeSourceCategory } from "../../src/domain/knowledge-source-category.js";
import { KnowledgeSourceState } from "../../src/domain/knowledge-source-state.js";
import { SourceNotFoundException } from "../../src/errors/source-not-found-exception.js";
import { KnowledgeSourceEventType } from "../../src/events/knowledge-source-event-type.js";
import { KnowledgeSourceEvents } from "../../src/events/knowledge-source-events.js";
import { KnowledgeSourceManager } from "../../src/manager/knowledge-source-manager.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

function buildManager() {
  const { publisher, publish } = fakePublisher();
  const manager = new KnowledgeSourceManager({ events: new KnowledgeSourceEvents(publisher) });
  return { manager, publish };
}

describe("KnowledgeSourceManager", () => {
  it("creates a Source and advances it through Registered/Configured/Validated", async () => {
    const { manager } = buildManager();
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    const source = await manager.create(metadataFixture(), configurationFixture(), context);
    expect(source.state).toBe(KnowledgeSourceState.VALIDATED);
    expect(source.history).toHaveLength(3);
  });

  it("advances to Enabled when configuration.enabled is true", async () => {
    const { manager } = buildManager();
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    const source = await manager.create(
      metadataFixture(),
      configurationFixture({ enabled: true }),
      context,
    );
    expect(source.state).toBe(KnowledgeSourceState.ENABLED);
  });

  it("publishes Created then Registered (via pipeline) then Enabled", async () => {
    const { manager, publish } = buildManager();
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    await manager.create(metadataFixture(), configurationFixture({ enabled: true }), context);
    const types = publish.mock.calls.map((call) => call[0].type);
    expect(types).toEqual([
      KnowledgeSourceEventType.CREATED,
      KnowledgeSourceEventType.REGISTERED,
      KnowledgeSourceEventType.ENABLED,
    ]);
  });

  it("registers the Source into the Catalog", async () => {
    const { manager } = buildManager();
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    await manager.create(metadataFixture(), configurationFixture(), context);
    expect(manager.catalog.get("source-1")).toBeDefined();
  });

  it("enable()/disable() transition an existing Source", async () => {
    const { manager } = buildManager();
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    const created = await manager.create(metadataFixture(), configurationFixture(), context);
    const enabled = await manager.enable(created.token);
    expect(enabled.state).toBe(KnowledgeSourceState.ENABLED);
    const disabled = await manager.disable(created.token);
    expect(disabled.state).toBe(KnowledgeSourceState.DISABLED);
  });

  it("archive() transitions an Enabled Source to Archived", async () => {
    const { manager } = buildManager();
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
    const archived = await manager.archive(created.token);
    expect(archived.state).toBe(KnowledgeSourceState.ARCHIVED);
  });

  it("remove() drives Deleted -> Destroyed and clears the Catalog/Registry", async () => {
    const { manager } = buildManager();
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
    expect(manager.catalog.get("source-1")).toBeUndefined();
  });

  it("getExecution/requireExecution look up by token, never by scan", async () => {
    const { manager } = buildManager();
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    const created = await manager.create(metadataFixture(), configurationFixture(), context);
    expect(manager.getExecution(created.token)?.metadata.sourceId).toBe("source-1");
    expect(manager.requireExecution(created.token).metadata.sourceId).toBe("source-1");
    expect(manager.getExecution("missing")).toBeUndefined();
    expect(() => manager.requireExecution("missing")).toThrow(SourceNotFoundException);
  });

  it("get() returns a KnowledgeSource view or undefined", async () => {
    const { manager } = buildManager();
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    const created = await manager.create(metadataFixture(), configurationFixture(), context);
    expect(manager.get(created.token)?.sourceId).toBe("source-1");
    expect(manager.get("missing")).toBeUndefined();
  });

  it("list() filters by tenantId", async () => {
    const { manager } = buildManager();
    await manager.create(
      metadataFixture({ sourceId: "s-1" }),
      configurationFixture({ sourceId: "s-1" }),
      createKnowledgeSourceContext({
        sourceId: "s-1",
        providerId: "provider-1",
        tenantId: "tenant-1",
      }),
    );
    await manager.create(
      metadataFixture({ sourceId: "s-2", tenantId: "tenant-2" }),
      configurationFixture({ sourceId: "s-2" }),
      createKnowledgeSourceContext({
        sourceId: "s-2",
        providerId: "provider-1",
        tenantId: "tenant-2",
      }),
    );
    expect(manager.list().length).toBe(2);
    expect(manager.list("tenant-1")).toHaveLength(1);
    expect(manager.count()).toBe(2);
  });

  it("registerPolicy/registerPermission delegate to Policy/Permission", () => {
    const { manager } = buildManager();
    const policy = manager.registerPolicy({
      id: "policy-1",
      name: "p",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    expect(policy.id).toBe("policy-1");
    const grant = manager.registerPermission({
      id: "grant-1",
      scope: { tenantId: "tenant-1" },
      effect: "allow",
      createdAt: new Date().toISOString(),
    });
    expect(grant.id).toBe("grant-1");
  });

  it("use() registers middleware and returns this", () => {
    const { manager } = buildManager();
    expect(manager.use(() => undefined)).toBe(manager);
    expect(manager.middleware.size).toBe(1);
  });

  it("health()/metrics()/monitorSnapshot() expose Monitor data", async () => {
    const { manager } = buildManager();
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    await manager.create(metadataFixture(), configurationFixture(), context);
    expect(manager.health().status).toBeDefined();
    expect(manager.metrics().sourceCount).toBe(1);
    expect(manager.monitorSnapshot().sampledAt).toBeTruthy();
  });

  it("rejects a Source that fails validation without registering it", async () => {
    const { manager } = buildManager();
    const context = createKnowledgeSourceContext({
      sourceId: "",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    await expect(
      manager.create(metadataFixture({ sourceId: "" }), configurationFixture(), context),
    ).rejects.toThrow();
  });

  it("classifies Sources by category via statistics", async () => {
    const { manager } = buildManager();
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    await manager.create(
      metadataFixture({ sourceCategory: KnowledgeSourceCategory.CRM }),
      configurationFixture(),
      context,
    );
    expect(manager.statistics.get(KnowledgeSourceCategory.CRM).registrationCount).toBe(1);
  });
});
