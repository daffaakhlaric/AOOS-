import { describe, expect, it } from "vitest";

import { AssetNotFoundException } from "../../src/errors/asset-not-found-exception.js";
import { InvalidNamespaceException } from "../../src/errors/invalid-namespace-exception.js";
import { KnowledgeRepository } from "../../src/repository/knowledge-repository.js";
import { KnowledgeResolver } from "../../src/resolver/knowledge-resolver.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Resolver Test — KnowledgeResolver", () => {
  it("resolveById() returns the saved Asset", () => {
    const repository = new KnowledgeRepository();
    const asset = assetFixture();
    repository.save(asset);
    const resolver = new KnowledgeResolver(repository);
    expect(resolver.resolveById(asset.id)).toBe(asset);
  });

  it("resolveById() throws AssetNotFoundException when unresolved", () => {
    const resolver = new KnowledgeResolver(new KnowledgeRepository());
    expect(() => resolver.resolveById("missing")).toThrow(AssetNotFoundException);
  });

  it("resolveByNamespace() returns the saved Asset", () => {
    const repository = new KnowledgeRepository();
    const asset = assetFixture();
    repository.save(asset);
    const resolver = new KnowledgeResolver(repository);
    expect(resolver.resolveByNamespace(asset.namespace)).toBe(asset);
  });

  it("resolveByNamespace() throws InvalidNamespaceException for a malformed URI", () => {
    const resolver = new KnowledgeResolver(new KnowledgeRepository());
    expect(() => resolver.resolveByNamespace("not-a-namespace")).toThrow(InvalidNamespaceException);
  });

  it("resolveByNamespace() throws AssetNotFoundException for a well-formed but unknown namespace", () => {
    const resolver = new KnowledgeResolver(new KnowledgeRepository());
    expect(() => resolver.resolveByNamespace("knowledge://t1/w1/l1/ghost")).toThrow(
      AssetNotFoundException,
    );
  });

  it("tryResolveById()/tryResolveByNamespace() return undefined instead of throwing", () => {
    const resolver = new KnowledgeResolver(new KnowledgeRepository());
    expect(resolver.tryResolveById("missing")).toBeUndefined();
    expect(resolver.tryResolveByNamespace("knowledge://t1/w1/l1/ghost")).toBeUndefined();
  });
});
