import { describe, expect, it } from "vitest";

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

describe("History", () => {
  it("records a history entry on createVersion()", async () => {
    const { versioning } = buildVersioning();
    const created = await create(versioning);
    const history = versioning.resolver.resolveHistory(created.versionId);
    expect(history.count()).toBe(1);
    expect(history.latest()?.operation).toBe("createVersion");
  });

  it("appends further entries as the lifecycle progresses", async () => {
    const { versioning } = buildVersioning();
    const created = await create(versioning);
    await versioning.publishVersion({ token: created.token });
    await versioning.archiveVersion({ token: created.token, reason: "sunset" });
    const history = versioning.resolver.resolveHistory(created.versionId);
    expect(history.count()).toBe(3);
    expect(history.latest()?.operation).toBe("archiveVersion");
    expect(history.latest()?.reason).toBe("sunset");
  });

  it("publishes HistoryRecorded when a version is created", async () => {
    const { versioning, publish } = buildVersioning();
    await create(versioning);
    expect(publish.mock.calls.map((call) => call[0].type)).toContain(
      "knowledge.version.history.recorded",
    );
  });

  it("resolveHistory() throws for a version with no recorded history", () => {
    const { versioning } = buildVersioning();
    expect(() => versioning.resolver.resolveHistory("never-created")).toThrow();
  });
});
