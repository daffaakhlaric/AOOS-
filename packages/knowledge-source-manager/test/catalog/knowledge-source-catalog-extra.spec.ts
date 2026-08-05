import { describe, expect, it } from "vitest";

import { KnowledgeSourceCatalog } from "../../src/catalog/knowledge-source-catalog.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("KnowledgeSourceCatalog additional coverage", () => {
  it("byNamespace/byCollection/byWorkspace/byTenant return empty for unknown keys", () => {
    const catalog = new KnowledgeSourceCatalog();
    expect(catalog.byNamespace("missing")).toEqual([]);
    expect(catalog.byCollection("missing")).toEqual([]);
    expect(catalog.byWorkspace("missing")).toEqual([]);
    expect(catalog.byTenant("missing")).toEqual([]);
  });

  it("removing the last Source under a key removes the key from the mapping entirely", () => {
    const catalog = new KnowledgeSourceCatalog();
    catalog.register(metadataFixture({ sourceId: "s-1", namespace: "ns-1" }));
    catalog.remove("s-1");
    expect(catalog.namespaceCount()).toBe(0);
  });

  it("keeps a shared key indexed while any Source under it remains", () => {
    const catalog = new KnowledgeSourceCatalog();
    catalog.register(metadataFixture({ sourceId: "s-1", namespace: "ns-1" }));
    catalog.register(metadataFixture({ sourceId: "s-2", namespace: "ns-1" }));
    catalog.remove("s-1");
    expect(catalog.byNamespace("ns-1")).toHaveLength(1);
    expect(catalog.namespaceCount()).toBe(1);
  });

  it("count() reflects the number of distinct registered Sources", () => {
    const catalog = new KnowledgeSourceCatalog();
    expect(catalog.count()).toBe(0);
    catalog.register(metadataFixture({ sourceId: "s-1" }));
    expect(catalog.count()).toBe(1);
  });
});
