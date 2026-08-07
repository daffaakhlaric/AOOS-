import { describe, expect, it } from "vitest";

import { SnapshotLimitExceededException } from "../../src/errors/snapshot-limit-exceeded-exception.js";
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

describe("Snapshots", () => {
  it("captures a snapshot resolvable via the Resolver", async () => {
    const { versioning } = buildVersioning();
    const context = contextFixture();
    const created = await versioning.createVersion({
      metadata: metadataFixture({ versionId: context.versionId, assetId: context.assetId }),
      configuration: configurationFixture({ versionId: context.versionId }),
      context,
    });
    const { snapshot } = await versioning.snapshotVersion({
      token: created.token,
      reason: "checkpoint",
    });
    expect(versioning.resolver.resolveSnapshot(snapshot.id)).toEqual(snapshot);
    expect(snapshot.reason).toBe("checkpoint");
    expect(snapshot.capturedState).toBe(created.state);
  });

  it("publishes SnapshotCreated", async () => {
    const { versioning, publish } = buildVersioning();
    const context = contextFixture();
    const created = await versioning.createVersion({
      metadata: metadataFixture({ versionId: context.versionId, assetId: context.assetId }),
      configuration: configurationFixture({ versionId: context.versionId }),
      context,
    });
    await versioning.snapshotVersion({ token: created.token });
    expect(publish.mock.calls.map((call) => call[0].type)).toContain(
      "knowledge.version.snapshot.created",
    );
  });

  it("enforces the maxSnapshots budget independently per version", async () => {
    const { versioning } = buildVersioning();
    const contextA = contextFixture({ versionId: "snap-a" });
    const createdA = await versioning.createVersion({
      metadata: metadataFixture({ versionId: "snap-a", assetId: contextA.assetId }),
      configuration: configurationFixture({ versionId: "snap-a", maxSnapshots: 1 }),
      context: contextA,
    });
    const contextB = contextFixture({ versionId: "snap-b" });
    const createdB = await versioning.createVersion({
      metadata: metadataFixture({ versionId: "snap-b", assetId: contextB.assetId }),
      configuration: configurationFixture({ versionId: "snap-b", maxSnapshots: 1 }),
      context: contextB,
    });
    await versioning.snapshotVersion({ token: createdA.token });
    await versioning.snapshotVersion({ token: createdB.token });
    await expect(versioning.snapshotVersion({ token: createdA.token })).rejects.toThrow(
      SnapshotLimitExceededException,
    );
    await expect(versioning.snapshotVersion({ token: createdB.token })).rejects.toThrow(
      SnapshotLimitExceededException,
    );
  });

  it("increments the snapshot metric per capture", async () => {
    const { versioning } = buildVersioning();
    const context = contextFixture();
    const created = await versioning.createVersion({
      metadata: metadataFixture({ versionId: context.versionId, assetId: context.assetId }),
      configuration: configurationFixture({ versionId: context.versionId }),
      context,
    });
    await versioning.snapshotVersion({ token: created.token });
    await versioning.snapshotVersion({ token: created.token });
    expect(versioning.metrics().snapshotCount).toBe(2);
  });
});
