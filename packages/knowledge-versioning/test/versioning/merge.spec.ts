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

async function create(versioning: KnowledgeVersioning, allowMerge = true) {
  const context = contextFixture();
  return versioning.createVersion({
    metadata: metadataFixture({ versionId: context.versionId, assetId: context.assetId }),
    configuration: configurationFixture({ versionId: context.versionId, allowMerge }),
    context,
  });
}

describe("Merge", () => {
  it("records a KnowledgeMerge with source/target/strategy", async () => {
    const { versioning } = buildVersioning();
    const created = await create(versioning);
    const result = await versioning.mergeVersion({
      token: created.token,
      targetVersionId: "target-v",
      strategy: "theirs",
    });
    expect(result.merge.sourceVersionId).toBe(created.versionId);
    expect(result.merge.targetVersionId).toBe("target-v");
    expect(result.merge.strategy).toBe("theirs");
  });

  it("moves the version to the Merged state", async () => {
    const { versioning } = buildVersioning();
    const created = await create(versioning);
    const result = await versioning.mergeVersion({ token: created.token, targetVersionId: "t" });
    expect(result.version.state).toBe(KnowledgeVersionState.MERGED);
  });

  it("publishes VersionMerged", async () => {
    const { versioning, publish } = buildVersioning();
    const created = await create(versioning);
    await versioning.mergeVersion({ token: created.token, targetVersionId: "t" });
    expect(publish.mock.calls.map((call) => call[0].type)).toContain("knowledge.version.merged");
  });

  it("rejects merge when the version's configuration disallows it", async () => {
    const { versioning } = buildVersioning();
    const created = await create(versioning, false);
    await expect(
      versioning.mergeVersion({ token: created.token, targetVersionId: "t" }),
    ).rejects.toThrow(VersionOperationException);
  });

  it("also merges from a Published state", async () => {
    const { versioning } = buildVersioning();
    const created = await create(versioning);
    await versioning.publishVersion({ token: created.token });
    const result = await versioning.mergeVersion({ token: created.token, targetVersionId: "t" });
    expect(result.version.state).toBe(KnowledgeVersionState.MERGED);
  });

  it("increments the merge metric", async () => {
    const { versioning } = buildVersioning();
    const created = await create(versioning);
    await versioning.mergeVersion({ token: created.token, targetVersionId: "t" });
    expect(versioning.metrics().mergeCount).toBe(1);
  });
});
