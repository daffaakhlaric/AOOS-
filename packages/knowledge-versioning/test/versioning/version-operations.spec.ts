import { describe, expect, it } from "vitest";

import { KnowledgeVersionState } from "../../src/domain/knowledge-version-state.js";
import { KnowledgeVersionEvents } from "../../src/events/knowledge-version-events.js";
import { KnowledgeVersioning } from "../../src/versioning/knowledge-versioning.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

function buildVersioning() {
  const { publisher, publish } = fakePublisher();
  return {
    versioning: new KnowledgeVersioning({ events: new KnowledgeVersionEvents(publisher) }),
    publish,
  };
}

async function create(versioning: KnowledgeVersioning) {
  const context = contextFixture();
  return versioning.createVersion({
    metadata: metadataFixture({ versionId: context.versionId, assetId: context.assetId }),
    configuration: configurationFixture({ versionId: context.versionId }),
    context,
  });
}

describe("Version Operations", () => {
  it("createVersion() registers a resolvable Version entry", async () => {
    const { versioning } = buildVersioning();
    const created = await create(versioning);
    const entry = versioning.resolver.resolveVersion(created.versionId);
    expect(entry.token).toBe(created.token);
  });

  it("publishVersion() publishes VersionPublished", async () => {
    const { versioning, publish } = buildVersioning();
    const created = await create(versioning);
    await versioning.publishVersion({ token: created.token });
    expect(publish.mock.calls.map((call) => call[0].type)).toContain("knowledge.version.published");
  });

  it("archiveVersion() publishes VersionArchived", async () => {
    const { versioning, publish } = buildVersioning();
    const created = await create(versioning);
    await versioning.publishVersion({ token: created.token });
    await versioning.archiveVersion({ token: created.token });
    expect(publish.mock.calls.map((call) => call[0].type)).toContain("knowledge.version.archived");
  });

  it("restoreVersion() publishes VersionRestored", async () => {
    const { versioning, publish } = buildVersioning();
    const created = await create(versioning);
    await versioning.publishVersion({ token: created.token });
    await versioning.archiveVersion({ token: created.token });
    await versioning.restoreVersion({ token: created.token });
    expect(publish.mock.calls.map((call) => call[0].type)).toContain("knowledge.version.restored");
  });

  it("destroyVersion() publishes VersionDestroyed and reaches the terminal state", async () => {
    const { versioning, publish } = buildVersioning();
    const created = await create(versioning);
    const destroyed = await versioning.destroyVersion({ token: created.token });
    expect(destroyed.state).toBe(KnowledgeVersionState.DESTROYED);
    expect(publish.mock.calls.map((call) => call[0].type)).toContain("knowledge.version.destroyed");
  });

  it("an operation on an unknown token throws", async () => {
    const { versioning } = buildVersioning();
    await expect(versioning.publishVersion({ token: "missing" })).rejects.toThrow();
  });

  it("publishVersion() rejects an illegal transition (already published)", async () => {
    const { versioning } = buildVersioning();
    const created = await create(versioning);
    await versioning.publishVersion({ token: created.token });
    await expect(versioning.publishVersion({ token: created.token })).rejects.toThrow();
  });

  it("cloneVersion() copies dependency-free metadata from the source", async () => {
    const { versioning } = buildVersioning();
    const created = await create(versioning);
    const cloned = await versioning.cloneVersion({
      token: created.token,
      newVersionId: "clone-op-1",
    });
    expect(cloned.metadata.assetId).toBe(created.assetId);
    expect(cloned.metadata.versionType).toBe(created.versionType);
  });

  it("multiple createVersion() calls each get independent tokens", async () => {
    const { versioning } = buildVersioning();
    const first = await create(versioning);
    const context2 = contextFixture({ versionId: "version-op-2" });
    const second = await versioning.createVersion({
      metadata: metadataFixture({ versionId: "version-op-2", assetId: context2.assetId }),
      configuration: configurationFixture({ versionId: "version-op-2" }),
      context: context2,
    });
    expect(first.token).not.toBe(second.token);
    expect(versioning.count()).toBe(2);
  });
});
