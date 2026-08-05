import { describe, expect, it } from "vitest";

import { KnowledgeProviderCategory } from "../../src/domain/knowledge-provider-category.js";
import { InvalidProviderMetadataException } from "../../src/errors/invalid-provider-metadata-exception.js";
import { ProviderNotFoundException } from "../../src/errors/provider-not-found-exception.js";
import { KnowledgeProviderMetadata } from "../../src/metadata/knowledge-provider-metadata.js";
import { KnowledgeProviderRegistry } from "../../src/registry/knowledge-provider-registry.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("KnowledgeProviderMetadata", () => {
  it("registers and gets a metadata record by providerId", () => {
    const metadata = new KnowledgeProviderMetadata(new KnowledgeProviderRegistry());
    metadata.register(metadataFixture());
    expect(metadata.get("provider-1")?.providerId).toBe("provider-1");
  });

  it("get() returns undefined for an unknown providerId", () => {
    const metadata = new KnowledgeProviderMetadata(new KnowledgeProviderRegistry());
    expect(metadata.get("missing")).toBeUndefined();
  });

  it("require() throws ProviderNotFoundException for an unknown providerId", () => {
    const metadata = new KnowledgeProviderMetadata(new KnowledgeProviderRegistry());
    expect(() => metadata.require("missing")).toThrow(ProviderNotFoundException);
  });

  it("update() patches an existing record", () => {
    const metadata = new KnowledgeProviderMetadata(new KnowledgeProviderRegistry());
    metadata.register(metadataFixture());
    const updated = metadata.update("provider-1", { providerName: "Updated Name" });
    expect(updated.providerName).toBe("Updated Name");
  });

  it("update() throws when changing providerId", () => {
    const metadata = new KnowledgeProviderMetadata(new KnowledgeProviderRegistry());
    metadata.register(metadataFixture());
    expect(() => metadata.update("provider-1", { providerId: "different" })).toThrow(
      InvalidProviderMetadataException,
    );
  });

  it("list() returns every registered record", () => {
    const metadata = new KnowledgeProviderMetadata(new KnowledgeProviderRegistry());
    metadata.register(metadataFixture());
    metadata.register(metadataFixture({ providerId: "provider-2" }));
    expect(metadata.list()).toHaveLength(2);
  });

  it("listByCategory() filters by providerCategory", () => {
    const metadata = new KnowledgeProviderMetadata(new KnowledgeProviderRegistry());
    metadata.register(metadataFixture({ providerCategory: KnowledgeProviderCategory.DOCUMENT }));
    metadata.register(
      metadataFixture({
        providerId: "provider-2",
        providerCategory: KnowledgeProviderCategory.DATABASE,
      }),
    );
    expect(metadata.listByCategory(KnowledgeProviderCategory.DATABASE)).toHaveLength(1);
  });

  it("update() preserves the same providerId when patch.providerId matches", () => {
    const metadata = new KnowledgeProviderMetadata(new KnowledgeProviderRegistry());
    metadata.register(metadataFixture());
    const updated = metadata.update("provider-1", {
      providerId: "provider-1",
      providerName: "Renamed",
    });
    expect(updated.providerId).toBe("provider-1");
    expect(updated.providerName).toBe("Renamed");
  });

  it("list() returns an empty array when nothing is registered", () => {
    const metadata = new KnowledgeProviderMetadata(new KnowledgeProviderRegistry());
    expect(metadata.list()).toEqual([]);
  });

  it("listByTag() filters by tag membership", () => {
    const metadata = new KnowledgeProviderMetadata(new KnowledgeProviderRegistry());
    metadata.register(metadataFixture({ providerTags: ["alpha"] }));
    metadata.register(metadataFixture({ providerId: "provider-2", providerTags: ["beta"] }));
    expect(metadata.listByTag("alpha")).toHaveLength(1);
  });
});
