import { describe, expect, it } from "vitest";

import { KnowledgeBranchType } from "../../src/domain/knowledge-branch-type.js";
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

describe("Branch Operations", () => {
  it("forkVersion() registers the Branch in the BRANCH registry bucket, resolvable via the Resolver", async () => {
    const { versioning } = buildVersioning();
    const context = contextFixture();
    const created = await versioning.createVersion({
      metadata: metadataFixture({ versionId: context.versionId, assetId: context.assetId }),
      configuration: configurationFixture({ versionId: context.versionId }),
      context,
    });
    const { branch } = await versioning.forkVersion({
      token: created.token,
      newVersionId: "forked-1",
      branchId: "ignored",
      branchName: "feature-y",
      branchType: KnowledgeBranchType.FEATURE,
    });
    expect(versioning.resolver.resolveBranch(branch.id)).toEqual(branch);
  });

  it("forkVersion() publishes a BranchCreated event", async () => {
    const { versioning, publish } = buildVersioning();
    const context = contextFixture();
    const created = await versioning.createVersion({
      metadata: metadataFixture({ versionId: context.versionId, assetId: context.assetId }),
      configuration: configurationFixture({ versionId: context.versionId }),
      context,
    });
    await versioning.forkVersion({
      token: created.token,
      newVersionId: "forked-2",
      branchId: "ignored",
      branchName: "feature-z",
      branchType: KnowledgeBranchType.FEATURE,
    });
    const types = publish.mock.calls.map((call) => call[0].type);
    expect(types).toContain("knowledge.version.branch.created");
  });

  it("forkVersion() sets sourceBranchId from the parent version's branchId when present", async () => {
    const { versioning } = buildVersioning();
    const context = contextFixture();
    const created = await versioning.createVersion({
      metadata: metadataFixture({ versionId: context.versionId, assetId: context.assetId }),
      configuration: configurationFixture({ versionId: context.versionId }),
      context,
    });
    const first = await versioning.forkVersion({
      token: created.token,
      newVersionId: "forked-3",
      branchId: "ignored",
      branchName: "feature-a",
      branchType: KnowledgeBranchType.FEATURE,
    });
    const second = await versioning.forkVersion({
      token: first.version.token,
      newVersionId: "forked-4",
      branchId: "ignored",
      branchName: "feature-b",
      branchType: KnowledgeBranchType.FEATURE,
    });
    expect(second.branch.sourceBranchId).toBe(first.branch.id);
  });

  it("forkVersion() increments the branch metric", async () => {
    const { versioning } = buildVersioning();
    const context = contextFixture();
    const created = await versioning.createVersion({
      metadata: metadataFixture({ versionId: context.versionId, assetId: context.assetId }),
      configuration: configurationFixture({ versionId: context.versionId }),
      context,
    });
    await versioning.forkVersion({
      token: created.token,
      newVersionId: "forked-5",
      branchId: "ignored",
      branchName: "feature-c",
      branchType: KnowledgeBranchType.HOTFIX,
    });
    expect(versioning.metrics().branchCount).toBe(1);
  });
});
