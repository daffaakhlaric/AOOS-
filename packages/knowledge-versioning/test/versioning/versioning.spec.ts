import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeBranchType } from "../../src/domain/knowledge-branch-type.js";
import { KnowledgeVersionState } from "../../src/domain/knowledge-version-state.js";
import { KnowledgeVersionType } from "../../src/domain/knowledge-version-type.js";
import { SnapshotLimitExceededException } from "../../src/errors/snapshot-limit-exceeded-exception.js";
import { VersionOperationException } from "../../src/errors/version-operation-exception.js";
import { KnowledgeVersionEvents } from "../../src/events/knowledge-version-events.js";
import { KnowledgeVersioning } from "../../src/versioning/knowledge-versioning.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

function buildVersioning() {
  const { publisher, publish } = fakePublisher();
  const versioning = new KnowledgeVersioning({ events: new KnowledgeVersionEvents(publisher) });
  return { versioning, publish };
}

async function createSampleVersion(
  versioning: KnowledgeVersioning,
  overrides: Parameters<typeof metadataFixture>[0] = {},
) {
  const versionId = overrides.versionId ?? "version-1";
  const context = contextFixture({ versionId });
  const metadata = metadataFixture({ assetId: context.assetId, ...overrides, versionId });
  const configuration = configurationFixture({ versionId });
  return versioning.createVersion({ metadata, configuration, context });
}

describe("KnowledgeVersioning", () => {
  let versioning: KnowledgeVersioning;

  beforeEach(() => {
    ({ versioning } = buildVersioning());
  });

  it("createVersion() drives Draft -> Created -> Validated and registers the version", async () => {
    const version = await createSampleVersion(versioning);
    expect(version.state).toBe(KnowledgeVersionState.VALIDATED);
    expect(versioning.count()).toBe(1);
    expect(versioning.get(version.token)?.versionId).toBe(version.versionId);
    expect(versioning.require(version.token).versionId).toBe(version.versionId);
    expect(versioning.list()).toHaveLength(1);
    expect(versioning.list("tenant-1")).toHaveLength(1);
    expect(versioning.list("other-tenant")).toHaveLength(0);
  });

  it("createVersion() publishes VersionCreated and HistoryRecorded events", async () => {
    const { publisher, publish } = fakePublisher();
    const local = new KnowledgeVersioning({ events: new KnowledgeVersionEvents(publisher) });
    await createSampleVersion(local);
    const types = publish.mock.calls.map((call) => call[0].type);
    expect(types).toContain("knowledge.version.created");
    expect(types).toContain("knowledge.version.history.recorded");
  });

  it("createVersion() rejects an invalid configuration", async () => {
    const context = contextFixture();
    const metadata = metadataFixture({ versionId: context.versionId, assetId: context.assetId });
    const configuration = configurationFixture({
      versionId: context.versionId,
      autoSnapshot: true,
      maxSnapshots: undefined,
    });
    await expect(versioning.createVersion({ metadata, configuration, context })).rejects.toThrow();
  });

  it("publishVersion() transitions Validated -> Published and records statistics", async () => {
    const created = await createSampleVersion(versioning);
    const published = await versioning.publishVersion({ token: created.token });
    expect(published.state).toBe(KnowledgeVersionState.PUBLISHED);
    expect(versioning.metrics().publishCount).toBe(1);
  });

  it("archiveVersion() transitions Published -> Archived", async () => {
    const created = await createSampleVersion(versioning);
    await versioning.publishVersion({ token: created.token });
    const archived = await versioning.archiveVersion({ token: created.token, reason: "old" });
    expect(archived.state).toBe(KnowledgeVersionState.ARCHIVED);
    expect(versioning.metrics().archiveCount).toBe(1);
  });

  it("restoreVersion() transitions Archived -> Restored", async () => {
    const created = await createSampleVersion(versioning);
    await versioning.publishVersion({ token: created.token });
    await versioning.archiveVersion({ token: created.token });
    const restored = await versioning.restoreVersion({ token: created.token });
    expect(restored.state).toBe(KnowledgeVersionState.RESTORED);
  });

  it("rollbackVersion() transitions Published -> RolledBack and returns a KnowledgeRollback", async () => {
    const created = await createSampleVersion(versioning);
    await versioning.publishVersion({ token: created.token });
    const result = await versioning.rollbackVersion({
      token: created.token,
      targetVersionId: "earlier-version",
      reason: "bad release",
    });
    expect(result.version.state).toBe(KnowledgeVersionState.ROLLED_BACK);
    expect(result.rollback.targetVersionId).toBe("earlier-version");
    expect(versioning.metrics().rollbackCount).toBe(1);
  });

  it("rollbackVersion() rejects when allowRollback=false", async () => {
    const context = contextFixture();
    const metadata = metadataFixture({ versionId: context.versionId, assetId: context.assetId });
    const configuration = configurationFixture({
      versionId: context.versionId,
      allowRollback: false,
    });
    const created = await versioning.createVersion({ metadata, configuration, context });
    await versioning.publishVersion({ token: created.token });
    await expect(
      versioning.rollbackVersion({ token: created.token, targetVersionId: "v0" }),
    ).rejects.toThrow(VersionOperationException);
  });

  it("mergeVersion() transitions Validated -> Merged and returns a KnowledgeMerge", async () => {
    const created = await createSampleVersion(versioning);
    const result = await versioning.mergeVersion({
      token: created.token,
      targetVersionId: "other-version",
      strategy: "manual",
    });
    expect(result.version.state).toBe(KnowledgeVersionState.MERGED);
    expect(result.merge.strategy).toBe("manual");
    expect(versioning.metrics().mergeCount).toBe(1);
  });

  it("mergeVersion() rejects when allowMerge=false", async () => {
    const context = contextFixture();
    const metadata = metadataFixture({ versionId: context.versionId, assetId: context.assetId });
    const configuration = configurationFixture({ versionId: context.versionId, allowMerge: false });
    const created = await versioning.createVersion({ metadata, configuration, context });
    await expect(
      versioning.mergeVersion({ token: created.token, targetVersionId: "v2" }),
    ).rejects.toThrow(VersionOperationException);
  });

  it("compareVersion() records comparison metadata without transitioning state", async () => {
    const created = await createSampleVersion(versioning);
    const result = await versioning.compareVersion({
      token: created.token,
      rightVersionId: "other-version",
      result: { fieldsChanged: 3 },
    });
    expect(result.comparison.leftVersionId).toBe(created.versionId);
    expect(result.comparison.rightVersionId).toBe("other-version");
    expect(versioning.require(created.token).state).toBe(KnowledgeVersionState.VALIDATED);
    expect(versioning.metrics().comparisonCount).toBe(1);
  });

  it("cloneVersion() creates a new Version and records a lineage edge", async () => {
    const created = await createSampleVersion(versioning);
    const cloned = await versioning.cloneVersion({
      token: created.token,
      newVersionId: "cloned-version",
      newVersionName: "Clone",
    });
    expect(cloned.versionId).toBe("cloned-version");
    expect(cloned.metadata.versionName).toBe("Clone");
    const lineage = versioning.resolver.resolveLineage(created.assetId);
    expect(lineage.parentsOf("cloned-version")).toEqual([created.versionId]);
  });

  it("forkVersion() creates a Branch and the Branch's initial Version", async () => {
    const created = await createSampleVersion(versioning);
    const result = await versioning.forkVersion({
      token: created.token,
      newVersionId: "forked-version",
      branchId: "unused",
      branchName: "feature-x",
      branchType: KnowledgeBranchType.FEATURE,
    });
    expect(result.branch.name).toBe("feature-x");
    expect(result.branch.headVersionId).toBe("forked-version");
    expect(result.version.versionId).toBe("forked-version");
    expect(result.version.branchId).toBe(result.branch.id);
    expect(versioning.metrics().branchCount).toBe(1);
  });

  it("snapshotVersion() captures a snapshot and enforces the maxSnapshots budget", async () => {
    const context = contextFixture();
    const metadata = metadataFixture({ versionId: context.versionId, assetId: context.assetId });
    const configuration = configurationFixture({ versionId: context.versionId, maxSnapshots: 1 });
    const created = await versioning.createVersion({ metadata, configuration, context });
    const first = await versioning.snapshotVersion({ token: created.token, name: "s1" });
    expect(first.snapshot.name).toBe("s1");
    await expect(versioning.snapshotVersion({ token: created.token })).rejects.toThrow(
      SnapshotLimitExceededException,
    );
    expect(versioning.metrics().snapshotCount).toBe(1);
  });

  it("snapshotVersion() allows unlimited snapshots when maxSnapshots is not set", async () => {
    const created = await createSampleVersion(versioning);
    await versioning.snapshotVersion({ token: created.token });
    await versioning.snapshotVersion({ token: created.token });
    expect(versioning.metrics().snapshotCount).toBe(2);
  });

  it("destroyVersion() transitions to the terminal Destroyed state", async () => {
    const created = await createSampleVersion(versioning);
    const destroyed = await versioning.destroyVersion({ token: created.token, reason: "cleanup" });
    expect(destroyed.state).toBe(KnowledgeVersionState.DESTROYED);
  });

  it("require() throws for an unknown token", () => {
    expect(() => versioning.require("missing")).toThrow();
  });

  it("get() returns undefined for an unknown token", () => {
    expect(versioning.get("missing")).toBeUndefined();
  });

  it("use() registers a middleware run around every pipeline call", async () => {
    let observed = 0;
    versioning.use((_execution, next) => {
      observed += 1;
      return next();
    });
    await createSampleVersion(versioning);
    expect(observed).toBeGreaterThan(0);
  });

  it("health()/metrics()/monitorSnapshot() expose live monitoring data", async () => {
    await createSampleVersion(versioning);
    expect(versioning.health().status).toBeTruthy();
    expect(versioning.metrics().versionCount).toBe(1);
    expect(versioning.monitorSnapshot().sampledAt).toBeTruthy();
  });

  it("exposes resolver/policy/permission/factory/middleware/configuration as public fields", () => {
    expect(versioning.resolver).toBeTruthy();
    expect(versioning.policy).toBeTruthy();
    expect(versioning.permission).toBeTruthy();
    expect(versioning.factory).toBeTruthy();
    expect(versioning.middleware).toBeTruthy();
    expect(versioning.configuration).toBeTruthy();
    expect(versioning.validator).toBeTruthy();
    expect(versioning.manager).toBeTruthy();
  });

  it("createVersion() twice for the same asset records createdCount by versionType", async () => {
    await createSampleVersion(versioning, { versionType: KnowledgeVersionType.MAJOR });
    expect(versioning.manager.statistics.get(KnowledgeVersionType.MAJOR).createdCount).toBe(1);
  });

  it("invokes a caller-supplied mergeStrategy/rollbackProvider/comparisonEngine/snapshotProvider when configured", async () => {
    const { publisher } = fakePublisher();
    const calls: string[] = [];
    const configured = new KnowledgeVersioning({
      events: new KnowledgeVersionEvents(publisher),
      config: {
        mergeStrategy: {
          name: "test",
          apply: () => {
            calls.push("merge");
          },
        },
        rollbackProvider: {
          rollback: () => {
            calls.push("rollback");
          },
        },
        comparisonEngine: {
          compare: () => {
            calls.push("compare");
            return { changed: true };
          },
        },
        snapshotProvider: {
          capture: () => {
            calls.push("snapshot");
          },
        },
      },
    });
    const created = await createSampleVersion(configured);
    await configured.mergeVersion({ token: created.token, targetVersionId: "v2" });
    expect(calls).toContain("merge");

    const created2 = await createSampleVersion(configured, { versionId: "version-2" });
    await configured.publishVersion({ token: created2.token });
    await configured.rollbackVersion({ token: created2.token, targetVersionId: "v0" });
    expect(calls).toContain("rollback");

    const created3 = await createSampleVersion(configured, { versionId: "version-3" });
    const comparison = await configured.compareVersion({
      token: created3.token,
      rightVersionId: "other",
    });
    expect(calls).toContain("compare");
    expect(comparison.comparison.result).toEqual({ changed: true });

    const created4 = await createSampleVersion(configured, { versionId: "version-4" });
    await configured.snapshotVersion({ token: created4.token });
    expect(calls).toContain("snapshot");
  });
});
