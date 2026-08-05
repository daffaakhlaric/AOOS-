import { describe, expect, it } from "vitest";

import { KnowledgeIndexBuilder } from "../../src/builder/knowledge-index-builder.js";
import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Builder Test — edge cases", () => {
  it("builds a LANGUAGE entry keyed by asset.metadata.language when set", () => {
    const asset = assetFixture();
    const withLanguage = { ...asset, metadata: { ...asset.metadata, language: "en" } };
    const [entry] = new KnowledgeIndexBuilder().build(
      withLanguage,
      KnowledgeIndexType.LANGUAGE,
      contextFixture(withLanguage),
    );
    expect(entry?.key).toBe("en");
  });

  it("builds a CATEGORY entry keyed by categoryId when set", () => {
    const asset = assetFixture({ categoryId: "cat-1" });
    const [entry] = new KnowledgeIndexBuilder().build(
      asset,
      KnowledgeIndexType.CATEGORY,
      contextFixture(asset),
    );
    expect(entry?.key).toBe("cat-1");
  });

  it("builds a DEPARTMENT entry keyed by scope.departmentId when set", () => {
    const asset = assetFixture({ scope: { tenantId: "tenant-1", departmentId: "dept-1" } });
    const [entry] = new KnowledgeIndexBuilder().build(
      asset,
      KnowledgeIndexType.DEPARTMENT,
      contextFixture(asset),
    );
    expect(entry?.key).toBe("dept-1");
  });

  it("builds a HYBRID_METADATA entry carrying tags/classification/assetType", () => {
    const asset = assetFixture({ tags: ["a", "b"] });
    const [entry] = new KnowledgeIndexBuilder().build(
      asset,
      KnowledgeIndexType.HYBRID_METADATA,
      contextFixture(asset),
    );
    expect(entry?.value).toEqual({
      tags: ["a", "b"],
      classification: asset.classification,
      assetType: asset.assetType,
    });
  });

  it("every TAG entry shares the same assetId/namespace/tenantId as its Asset", () => {
    const asset = assetFixture({ tags: ["a", "b"] });
    const entries = new KnowledgeIndexBuilder().build(
      asset,
      KnowledgeIndexType.TAG,
      contextFixture(asset),
    );
    for (const entry of entries) {
      expect(entry.assetId).toBe(asset.id);
      expect(entry.namespace).toBe(asset.namespace);
      expect(entry.tenantId).toBe(asset.scope.tenantId);
    }
  });
});
