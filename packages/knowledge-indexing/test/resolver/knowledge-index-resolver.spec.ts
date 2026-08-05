import { describe, expect, it } from "vitest";

import { KnowledgeIndexBuilder } from "../../src/builder/knowledge-index-builder.js";
import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { IndexNotFoundException } from "../../src/errors/index-not-found-exception.js";
import { KnowledgeIndexRegistryBucket } from "../../src/registry/knowledge-index-registry-bucket.js";
import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import { KnowledgeIndexResolver } from "../../src/resolver/knowledge-index-resolver.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

function seed(registry: KnowledgeIndexRegistry) {
  const builder = new KnowledgeIndexBuilder();
  const asset = assetFixture();
  const [keywordEntry] = builder.build(asset, KnowledgeIndexType.KEYWORD, contextFixture(asset));
  const [namespaceEntry] = builder.build(
    asset,
    KnowledgeIndexType.NAMESPACE,
    contextFixture(asset),
  );
  registry.register(KnowledgeIndexRegistryBucket.INDEX, keywordEntry!);
  registry.register(KnowledgeIndexRegistryBucket.INDEX, namespaceEntry!);
  return { asset, keywordEntry: keywordEntry!, namespaceEntry: namespaceEntry! };
}

describe("Resolver Test — KnowledgeIndexResolver", () => {
  it("resolveById()/tryResolveById() resolve a registered entry", () => {
    const registry = new KnowledgeIndexRegistry();
    const { keywordEntry } = seed(registry);
    const resolver = new KnowledgeIndexResolver(registry);
    expect(resolver.resolveById(keywordEntry.id)).toBe(keywordEntry);
    expect(resolver.tryResolveById(keywordEntry.id)).toBe(keywordEntry);
  });

  it("resolveById() throws IndexNotFoundException for an unknown id", () => {
    const resolver = new KnowledgeIndexResolver(new KnowledgeIndexRegistry());
    expect(() => resolver.resolveById("missing")).toThrow(IndexNotFoundException);
  });

  it("tryResolveById() returns undefined for an unknown id", () => {
    const resolver = new KnowledgeIndexResolver(new KnowledgeIndexRegistry());
    expect(resolver.tryResolveById("missing")).toBeUndefined();
  });

  it("resolveByAsset() returns every entry for that assetId", () => {
    const registry = new KnowledgeIndexRegistry();
    const { asset } = seed(registry);
    const resolver = new KnowledgeIndexResolver(registry);
    expect(resolver.resolveByAsset(asset.id)).toHaveLength(2);
  });

  it("resolveByType() filters by KnowledgeIndexType", () => {
    const registry = new KnowledgeIndexRegistry();
    seed(registry);
    const resolver = new KnowledgeIndexResolver(registry);
    expect(resolver.resolveByType(KnowledgeIndexType.KEYWORD)).toHaveLength(1);
  });

  it("resolveByNamespace() filters by namespace", () => {
    const registry = new KnowledgeIndexRegistry();
    const { asset } = seed(registry);
    const resolver = new KnowledgeIndexResolver(registry);
    expect(resolver.resolveByNamespace(asset.namespace)).toHaveLength(2);
  });
});
