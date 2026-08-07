import { describe, expect, it } from "vitest";

import { KnowledgeBranchType } from "../../src/domain/knowledge-branch-type.js";
import { KnowledgeVersionState } from "../../src/domain/knowledge-version-state.js";
import { VersionNotFoundException } from "../../src/errors/version-not-found-exception.js";
import { KnowledgeVersionRegistryBucket } from "../../src/registry/knowledge-version-registry-bucket.js";
import { KnowledgeVersionRegistry } from "../../src/registry/knowledge-version-registry.js";
import { KnowledgeVersionResolver } from "../../src/resolver/knowledge-version-resolver.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("KnowledgeVersionResolver", () => {
  function build() {
    const registry = new KnowledgeVersionRegistry();
    const resolver = new KnowledgeVersionResolver(registry);
    return { registry, resolver };
  }

  it("resolves a registered Version entry", () => {
    const { registry, resolver } = build();
    const entry = {
      id: "v1",
      token: "kver_1",
      metadata: metadataFixture(),
      configuration: configurationFixture(),
    };
    registry.register(KnowledgeVersionRegistryBucket.VERSION, entry);
    expect(resolver.resolveVersion("v1")).toEqual(entry);
    expect(resolver.tryResolveVersion("v1")).toEqual(entry);
  });

  it("throws resolving a missing Version, and tryResolve returns undefined", () => {
    const { resolver } = build();
    expect(() => resolver.resolveVersion("missing")).toThrow(VersionNotFoundException);
    expect(resolver.tryResolveVersion("missing")).toBeUndefined();
  });

  it("resolves a registered Snapshot", () => {
    const { registry, resolver } = build();
    const snapshot = {
      id: "s1",
      versionId: "v1",
      capturedState: KnowledgeVersionState.DRAFT,
      capturedAt: new Date().toISOString(),
    };
    registry.register(KnowledgeVersionRegistryBucket.SNAPSHOT, snapshot);
    expect(resolver.resolveSnapshot("s1")).toEqual(snapshot);
    expect(resolver.tryResolveSnapshot("s1")).toEqual(snapshot);
  });

  it("throws resolving a missing Snapshot", () => {
    const { resolver } = build();
    expect(() => resolver.resolveSnapshot("missing")).toThrow(VersionNotFoundException);
    expect(resolver.tryResolveSnapshot("missing")).toBeUndefined();
  });

  it("resolves a registered Branch", () => {
    const { registry, resolver } = build();
    const branch = {
      id: "b1",
      name: "main",
      branchType: KnowledgeBranchType.MAIN,
      assetId: "a1",
      tenantId: "tenant-1",
      createdAt: new Date().toISOString(),
    };
    registry.register(KnowledgeVersionRegistryBucket.BRANCH, branch);
    expect(resolver.resolveBranch("b1")).toEqual(branch);
    expect(resolver.tryResolveBranch("b1")).toEqual(branch);
  });

  it("throws resolving a missing Branch", () => {
    const { resolver } = build();
    expect(() => resolver.resolveBranch("missing")).toThrow(VersionNotFoundException);
    expect(resolver.tryResolveBranch("missing")).toBeUndefined();
  });

  it("resolves registered History", () => {
    const { registry, resolver } = build();
    const history = { id: "v1", versionId: "v1" };
    registry.register(KnowledgeVersionRegistryBucket.HISTORY, history);
    expect(resolver.resolveHistory("v1")).toEqual(history);
    expect(resolver.tryResolveHistory("v1")).toEqual(history);
  });

  it("throws resolving missing History", () => {
    const { resolver } = build();
    expect(() => resolver.resolveHistory("missing")).toThrow(VersionNotFoundException);
    expect(resolver.tryResolveHistory("missing")).toBeUndefined();
  });

  it("resolves registered Lineage", () => {
    const { registry, resolver } = build();
    const lineage = { id: "a1", assetId: "a1" };
    registry.register(KnowledgeVersionRegistryBucket.LINEAGE, lineage);
    expect(resolver.resolveLineage("a1")).toEqual(lineage);
    expect(resolver.tryResolveLineage("a1")).toEqual(lineage);
  });

  it("throws resolving missing Lineage", () => {
    const { resolver } = build();
    expect(() => resolver.resolveLineage("missing")).toThrow(VersionNotFoundException);
    expect(resolver.tryResolveLineage("missing")).toBeUndefined();
  });

  it("resolves a Comparison stored in the METADATA bucket", () => {
    const { registry, resolver } = build();
    const comparison = {
      id: "c1",
      leftVersionId: "v1",
      rightVersionId: "v2",
      comparedAt: new Date().toISOString(),
    };
    registry.register(KnowledgeVersionRegistryBucket.METADATA, comparison);
    expect(resolver.resolveComparison("c1")).toEqual(comparison);
    expect(resolver.tryResolveComparison("c1")).toEqual(comparison);
  });

  it("throws resolving a missing Comparison", () => {
    const { resolver } = build();
    expect(() => resolver.resolveComparison("missing")).toThrow(VersionNotFoundException);
  });

  it("tryResolveComparison returns undefined for a METADATA entry that isn't a Comparison shape", () => {
    const { registry, resolver } = build();
    registry.register(KnowledgeVersionRegistryBucket.METADATA, { id: "not-a-comparison" });
    expect(resolver.tryResolveComparison("not-a-comparison")).toBeUndefined();
  });

  it("resolveComparison throws when the METADATA entry doesn't parse as a Comparison", () => {
    const { registry, resolver } = build();
    registry.register(KnowledgeVersionRegistryBucket.METADATA, { id: "bad" });
    expect(() => resolver.resolveComparison("bad")).toThrow(VersionNotFoundException);
  });
});
