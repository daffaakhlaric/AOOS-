import { describe, expect, it } from "vitest";

import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import { KnowledgeIndexResolver } from "../../src/resolver/knowledge-index-resolver.js";

describe("Resolver Test — edge cases", () => {
  it("resolveByAsset() returns an empty array for an unknown assetId", () => {
    const resolver = new KnowledgeIndexResolver(new KnowledgeIndexRegistry());
    expect(resolver.resolveByAsset("missing")).toEqual([]);
  });

  it("resolveByType() returns an empty array when nothing of that type is registered", () => {
    const resolver = new KnowledgeIndexResolver(new KnowledgeIndexRegistry());
    expect(resolver.resolveByType(KnowledgeIndexType.TAG)).toEqual([]);
  });

  it("resolveByNamespace() returns an empty array for an unknown namespace", () => {
    const resolver = new KnowledgeIndexResolver(new KnowledgeIndexRegistry());
    expect(resolver.resolveByNamespace("knowledge://t/w/l/missing")).toEqual([]);
  });
});
