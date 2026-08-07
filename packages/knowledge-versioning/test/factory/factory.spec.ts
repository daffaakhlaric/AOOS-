import { describe, expect, it } from "vitest";

import { KnowledgeBranchType } from "../../src/domain/knowledge-branch-type.js";
import { KnowledgeHistory } from "../../src/domain/knowledge-history.js";
import { KnowledgeVersionState } from "../../src/domain/knowledge-version-state.js";
import { KnowledgeVersionType } from "../../src/domain/knowledge-version-type.js";
import { KnowledgeVersionFactory } from "../../src/factory/knowledge-version-factory.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("KnowledgeVersionFactory", () => {
  const factory = new KnowledgeVersionFactory();

  it("composes all 6 sub-factories", () => {
    expect(factory.version).toBeTruthy();
    expect(factory.snapshot).toBeTruthy();
    expect(factory.branch).toBeTruthy();
    expect(factory.history).toBeTruthy();
    expect(factory.metadata).toBeTruthy();
    expect(factory.configuration).toBeTruthy();
  });

  it("version factory builds valid KnowledgeVersionMetadata", () => {
    const metadata = factory.version.create({
      versionId: "v1",
      assetId: "a1",
      versionType: KnowledgeVersionType.MAJOR,
      versionNumber: "1.0.0",
      tenantId: "tenant-1",
    });
    expect(metadata.versionId).toBe("v1");
    expect(metadata.labels).toEqual([]);
    expect(metadata.dependencies).toEqual([]);
    expect(metadata.createdAt).toBe(metadata.updatedAt);
  });

  it("version factory honors optional fields", () => {
    const metadata = factory.version.create({
      versionId: "v1",
      assetId: "a1",
      versionType: KnowledgeVersionType.MAJOR,
      versionNumber: "1.0.0",
      tenantId: "tenant-1",
      versionName: "n",
      versionDescription: "d",
      branchId: "b1",
      workspaceId: "w1",
      labels: ["l1"],
      tags: ["t1"],
      dependencies: ["dep-1"],
      createdBy: "user-1",
    });
    expect(metadata.versionName).toBe("n");
    expect(metadata.branchId).toBe("b1");
    expect(metadata.labels).toEqual(["l1"]);
    expect(metadata.createdBy).toBe("user-1");
    expect(metadata.updatedBy).toBe("user-1");
  });

  it("snapshot factory builds a KnowledgeSnapshot with a generated id", () => {
    const snapshot = factory.snapshot.create({
      versionId: "v1",
      capturedState: KnowledgeVersionState.DRAFT,
    });
    expect(snapshot.id).toBeTruthy();
    expect(snapshot.versionId).toBe("v1");
    expect(snapshot.capturedState).toBe(KnowledgeVersionState.DRAFT);
  });

  it("branch factory builds a KnowledgeBranch with a generated id", () => {
    const branch = factory.branch.create({
      name: "feature-x",
      branchType: KnowledgeBranchType.FEATURE,
      assetId: "a1",
      tenantId: "tenant-1",
    });
    expect(branch.id).toBeTruthy();
    expect(branch.branchType).toBe(KnowledgeBranchType.FEATURE);
  });

  it("history factory builds an empty KnowledgeHistory aggregate", () => {
    const history = factory.history.create("v1");
    expect(history).toBeInstanceOf(KnowledgeHistory);
    expect(history.count()).toBe(0);
  });

  it("metadata factory updates fields and bumps updatedAt", () => {
    const original = metadataFixture();
    const updated = factory.metadata.update(original, {
      versionName: "new-name",
      labels: ["a"],
      updatedBy: "editor",
    });
    expect(updated.versionName).toBe("new-name");
    expect(updated.labels).toEqual(["a"]);
    expect(updated.updatedBy).toBe("editor");
    expect(updated.versionId).toBe(original.versionId);
  });

  it("metadata factory overrides tags and dependencies when supplied", () => {
    const original = metadataFixture({ tags: ["old"], dependencies: ["old-dep"] });
    const updated = factory.metadata.update(original, {
      tags: ["new"],
      dependencies: ["new-dep"],
    });
    expect(updated.tags).toEqual(["new"]);
    expect(updated.dependencies).toEqual(["new-dep"]);
  });

  it("metadata factory preserves fields not overridden", () => {
    const original = metadataFixture({ tags: ["kept"] });
    const updated = factory.metadata.update(original, {});
    expect(updated.tags).toEqual(["kept"]);
    expect(updated.versionName).toBe(original.versionName);
  });

  it("configuration factory builds sensible defaults", () => {
    const configuration = factory.configuration.create({ versionId: "v1" });
    expect(configuration.autoSnapshot).toBe(false);
    expect(configuration.immutablePublished).toBe(true);
    expect(configuration.allowRollback).toBe(true);
    expect(configuration.allowMerge).toBe(true);
    expect(configuration.settings).toEqual({});
  });

  it("configuration factory honors overrides", () => {
    const configuration = factory.configuration.create({
      versionId: "v1",
      autoSnapshot: true,
      maxSnapshots: 3,
      settings: { label: "x" },
    });
    expect(configuration.autoSnapshot).toBe(true);
    expect(configuration.maxSnapshots).toBe(3);
    expect(configuration.settings).toEqual({ label: "x" });
  });
});
