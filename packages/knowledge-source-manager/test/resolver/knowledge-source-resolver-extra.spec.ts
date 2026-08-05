import { describe, expect, it } from "vitest";

import { KnowledgeSourceCatalog } from "../../src/catalog/knowledge-source-catalog.js";
import { KnowledgeSourceResolver } from "../../src/resolver/knowledge-source-resolver.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("KnowledgeSourceResolver additional coverage", () => {
  it("resolveByPolicy returns empty when no Source references the policy", () => {
    const catalog = new KnowledgeSourceCatalog();
    const resolver = new KnowledgeSourceResolver(catalog);
    catalog.register(metadataFixture({ sourceId: "s-1" }));
    expect(resolver.resolveByPolicy("missing-policy")).toEqual([]);
  });

  it("resolveByPermission returns empty when no Source references the permission", () => {
    const catalog = new KnowledgeSourceCatalog();
    const resolver = new KnowledgeSourceResolver(catalog);
    catalog.register(metadataFixture({ sourceId: "s-1" }));
    expect(resolver.resolveByPermission("missing-permission")).toEqual([]);
  });

  it("resolveByPriority is stable for equal priorities", () => {
    const catalog = new KnowledgeSourceCatalog();
    const resolver = new KnowledgeSourceResolver(catalog);
    catalog.register(metadataFixture({ sourceId: "s-1", priority: 1 }));
    catalog.register(metadataFixture({ sourceId: "s-2", priority: 1 }));
    expect(resolver.resolveByPriority()).toHaveLength(2);
  });

  it("resolveByCollection returns empty when the collection is unknown", () => {
    const catalog = new KnowledgeSourceCatalog();
    const resolver = new KnowledgeSourceResolver(catalog);
    expect(resolver.resolveByCollection("missing")).toEqual([]);
  });
});
