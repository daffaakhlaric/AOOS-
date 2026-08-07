import { describe, expect, it } from "vitest";

import { KnowledgeVersionState } from "../../src/domain/knowledge-version-state.js";
import { VersionOperationException } from "../../src/errors/version-operation-exception.js";
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

describe("Rollback", () => {
  it("records a KnowledgeRollback with the requested targetVersionId and reason", async () => {
    const { versioning } = buildVersioning();
    const context = contextFixture();
    const created = await versioning.createVersion({
      metadata: metadataFixture({ versionId: context.versionId, assetId: context.assetId }),
      configuration: configurationFixture({ versionId: context.versionId }),
      context,
    });
    await versioning.publishVersion({ token: created.token });
    const result = await versioning.rollbackVersion({
      token: created.token,
      targetVersionId: "v-earlier",
      reason: "regression",
    });
    expect(result.rollback.versionId).toBe(created.versionId);
    expect(result.rollback.targetVersionId).toBe("v-earlier");
    expect(result.rollback.reason).toBe("regression");
    expect(result.rollback.occurredAt).toBeTruthy();
  });

  it("moves the version to the RolledBack state", async () => {
    const { versioning } = buildVersioning();
    const context = contextFixture();
    const created = await versioning.createVersion({
      metadata: metadataFixture({ versionId: context.versionId, assetId: context.assetId }),
      configuration: configurationFixture({ versionId: context.versionId }),
      context,
    });
    await versioning.publishVersion({ token: created.token });
    const result = await versioning.rollbackVersion({
      token: created.token,
      targetVersionId: "v0",
    });
    expect(result.version.state).toBe(KnowledgeVersionState.ROLLED_BACK);
  });

  it("publishes VersionRolledBack", async () => {
    const { versioning, publish } = buildVersioning();
    const context = contextFixture();
    const created = await versioning.createVersion({
      metadata: metadataFixture({ versionId: context.versionId, assetId: context.assetId }),
      configuration: configurationFixture({ versionId: context.versionId }),
      context,
    });
    await versioning.publishVersion({ token: created.token });
    await versioning.rollbackVersion({ token: created.token, targetVersionId: "v0" });
    expect(publish.mock.calls.map((call) => call[0].type)).toContain(
      "knowledge.version.rolledback",
    );
  });

  it("rejects rollback from a non-published state", async () => {
    const { versioning } = buildVersioning();
    const context = contextFixture();
    const created = await versioning.createVersion({
      metadata: metadataFixture({ versionId: context.versionId, assetId: context.assetId }),
      configuration: configurationFixture({ versionId: context.versionId }),
      context,
    });
    await expect(
      versioning.rollbackVersion({ token: created.token, targetVersionId: "v0" }),
    ).rejects.toThrow();
  });

  it("rejects rollback when the version's configuration disallows it", async () => {
    const { versioning } = buildVersioning();
    const context = contextFixture();
    const created = await versioning.createVersion({
      metadata: metadataFixture({ versionId: context.versionId, assetId: context.assetId }),
      configuration: configurationFixture({ versionId: context.versionId, allowRollback: false }),
      context,
    });
    await versioning.publishVersion({ token: created.token });
    await expect(
      versioning.rollbackVersion({ token: created.token, targetVersionId: "v0" }),
    ).rejects.toThrow(VersionOperationException);
  });
});
