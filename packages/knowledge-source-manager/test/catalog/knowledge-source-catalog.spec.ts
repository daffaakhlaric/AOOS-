import { describe, expect, it } from "vitest";

import { KnowledgeSourceCatalog } from "../../src/catalog/knowledge-source-catalog.js";
import { CatalogEntryNotFoundException } from "../../src/errors/catalog-entry-not-found-exception.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("KnowledgeSourceCatalog", () => {
  it("registers a Source and returns it via get()", () => {
    const catalog = new KnowledgeSourceCatalog();
    const metadata = metadataFixture();
    catalog.register(metadata);
    expect(catalog.get(metadata.sourceId)).toEqual(metadata);
  });

  it("require throws CatalogEntryNotFoundException for an unknown id", () => {
    const catalog = new KnowledgeSourceCatalog();
    expect(() => catalog.require("missing")).toThrow(CatalogEntryNotFoundException);
  });

  it("require returns the entry for a known id", () => {
    const catalog = new KnowledgeSourceCatalog();
    const metadata = metadataFixture();
    catalog.register(metadata);
    expect(catalog.require(metadata.sourceId)).toEqual(metadata);
  });

  it("indexes by Provider Mapping", () => {
    const catalog = new KnowledgeSourceCatalog();
    catalog.register(metadataFixture({ sourceId: "s-1", providerId: "p-1" }));
    catalog.register(metadataFixture({ sourceId: "s-2", providerId: "p-1" }));
    expect(catalog.byProvider("p-1")).toHaveLength(2);
    expect(catalog.providerCount()).toBe(1);
  });

  it("indexes by Namespace Mapping", () => {
    const catalog = new KnowledgeSourceCatalog();
    catalog.register(metadataFixture({ sourceId: "s-1", namespace: "ns-1" }));
    expect(catalog.byNamespace("ns-1")).toHaveLength(1);
    expect(catalog.namespaceCount()).toBe(1);
  });

  it("indexes by Collection Mapping", () => {
    const catalog = new KnowledgeSourceCatalog();
    catalog.register(metadataFixture({ sourceId: "s-1", collection: "col-1" }));
    expect(catalog.byCollection("col-1")).toHaveLength(1);
    expect(catalog.collectionCount()).toBe(1);
  });

  it("indexes by Workspace Mapping", () => {
    const catalog = new KnowledgeSourceCatalog();
    catalog.register(metadataFixture({ sourceId: "s-1", workspaceId: "ws-1" }));
    expect(catalog.byWorkspace("ws-1")).toHaveLength(1);
    expect(catalog.workspaceCount()).toBe(1);
  });

  it("indexes by Tenant Mapping", () => {
    const catalog = new KnowledgeSourceCatalog();
    catalog.register(metadataFixture({ sourceId: "s-1", tenantId: "t-1" }));
    expect(catalog.byTenant("t-1")).toHaveLength(1);
    expect(catalog.tenantCount()).toBe(1);
  });

  it("does not index namespace/collection/workspace when absent", () => {
    const catalog = new KnowledgeSourceCatalog();
    catalog.register(
      metadataFixture({
        sourceId: "s-1",
        namespace: undefined,
        collection: undefined,
        workspaceId: undefined,
      }),
    );
    expect(catalog.namespaceCount()).toBe(0);
    expect(catalog.collectionCount()).toBe(0);
    expect(catalog.workspaceCount()).toBe(0);
  });

  it("re-registering the same sourceId replaces the prior indexes", () => {
    const catalog = new KnowledgeSourceCatalog();
    catalog.register(metadataFixture({ sourceId: "s-1", namespace: "ns-old" }));
    catalog.register(metadataFixture({ sourceId: "s-1", namespace: "ns-new" }));
    expect(catalog.byNamespace("ns-old")).toHaveLength(0);
    expect(catalog.byNamespace("ns-new")).toHaveLength(1);
    expect(catalog.count()).toBe(1);
  });

  it("removes a Source and its index entries", () => {
    const catalog = new KnowledgeSourceCatalog();
    const metadata = metadataFixture({ sourceId: "s-1", namespace: "ns-1", collection: "col-1" });
    catalog.register(metadata);
    expect(catalog.remove("s-1")).toBe(true);
    expect(catalog.get("s-1")).toBeUndefined();
    expect(catalog.byNamespace("ns-1")).toHaveLength(0);
    expect(catalog.byCollection("col-1")).toHaveLength(0);
  });

  it("remove returns false for an unknown id", () => {
    const catalog = new KnowledgeSourceCatalog();
    expect(catalog.remove("missing")).toBe(false);
  });

  it("all() lists every registered Source", () => {
    const catalog = new KnowledgeSourceCatalog();
    catalog.register(metadataFixture({ sourceId: "s-1" }));
    catalog.register(metadataFixture({ sourceId: "s-2" }));
    expect(catalog.all()).toHaveLength(2);
    expect(catalog.count()).toBe(2);
  });

  it("byProvider returns empty for an unknown provider", () => {
    const catalog = new KnowledgeSourceCatalog();
    expect(catalog.byProvider("missing")).toEqual([]);
  });
});
