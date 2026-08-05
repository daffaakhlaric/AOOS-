import { describe, expect, it } from "vitest";

import { KnowledgeSourceCatalog } from "../../src/catalog/knowledge-source-catalog.js";
import { KnowledgeSourceCategory } from "../../src/domain/knowledge-source-category.js";
import { SourceNotFoundException } from "../../src/errors/source-not-found-exception.js";
import { KnowledgeSourceResolver } from "../../src/resolver/knowledge-source-resolver.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

function build(): { catalog: KnowledgeSourceCatalog; resolver: KnowledgeSourceResolver } {
  const catalog = new KnowledgeSourceCatalog();
  return { catalog, resolver: new KnowledgeSourceResolver(catalog) };
}

describe("KnowledgeSourceResolver", () => {
  it("resolveById returns the Source", () => {
    const { catalog, resolver } = build();
    catalog.register(metadataFixture({ sourceId: "s-1" }));
    expect(resolver.resolveById("s-1").sourceId).toBe("s-1");
  });

  it("resolveById throws SourceNotFoundException when missing", () => {
    const { resolver } = build();
    expect(() => resolver.resolveById("missing")).toThrow(SourceNotFoundException);
  });

  it("tryResolveById returns undefined when missing", () => {
    const { resolver } = build();
    expect(resolver.tryResolveById("missing")).toBeUndefined();
  });

  it("resolveByProvider", () => {
    const { catalog, resolver } = build();
    catalog.register(metadataFixture({ sourceId: "s-1", providerId: "p-1" }));
    expect(resolver.resolveByProvider("p-1")).toHaveLength(1);
  });

  it("resolveByCategory", () => {
    const { catalog, resolver } = build();
    catalog.register(
      metadataFixture({ sourceId: "s-1", sourceCategory: KnowledgeSourceCategory.CRM }),
    );
    expect(resolver.resolveByCategory(KnowledgeSourceCategory.CRM)).toHaveLength(1);
    expect(resolver.resolveByCategory(KnowledgeSourceCategory.ERP)).toHaveLength(0);
  });

  it("resolveByWorkspace", () => {
    const { catalog, resolver } = build();
    catalog.register(metadataFixture({ sourceId: "s-1", workspaceId: "ws-1" }));
    expect(resolver.resolveByWorkspace("ws-1")).toHaveLength(1);
  });

  it("resolveByTenant", () => {
    const { catalog, resolver } = build();
    catalog.register(metadataFixture({ sourceId: "s-1", tenantId: "t-1" }));
    expect(resolver.resolveByTenant("t-1")).toHaveLength(1);
  });

  it("resolveByNamespace", () => {
    const { catalog, resolver } = build();
    catalog.register(metadataFixture({ sourceId: "s-1", namespace: "ns-1" }));
    expect(resolver.resolveByNamespace("ns-1")).toHaveLength(1);
  });

  it("resolveByCollection", () => {
    const { catalog, resolver } = build();
    catalog.register(metadataFixture({ sourceId: "s-1", collection: "col-1" }));
    expect(resolver.resolveByCollection("col-1")).toHaveLength(1);
  });

  it("resolveByPolicy", () => {
    const { catalog, resolver } = build();
    catalog.register(metadataFixture({ sourceId: "s-1", policy: "policy-1" }));
    expect(resolver.resolveByPolicy("policy-1")).toHaveLength(1);
  });

  it("resolveByPermission", () => {
    const { catalog, resolver } = build();
    catalog.register(metadataFixture({ sourceId: "s-1", permission: "perm-1" }));
    expect(resolver.resolveByPermission("perm-1")).toHaveLength(1);
  });

  it("resolveByMetadata applies a predicate", () => {
    const { catalog, resolver } = build();
    catalog.register(metadataFixture({ sourceId: "s-1", owner: "alice" }));
    catalog.register(metadataFixture({ sourceId: "s-2", owner: "bob" }));
    expect(resolver.resolveByMetadata((metadata) => metadata.owner === "alice")).toHaveLength(1);
  });

  it("resolveByPriority sorts descending", () => {
    const { catalog, resolver } = build();
    catalog.register(metadataFixture({ sourceId: "s-1", priority: 1 }));
    catalog.register(metadataFixture({ sourceId: "s-2", priority: 5 }));
    const sorted = resolver.resolveByPriority();
    expect(sorted[0]?.sourceId).toBe("s-2");
    expect(sorted[1]?.sourceId).toBe("s-1");
  });
});
