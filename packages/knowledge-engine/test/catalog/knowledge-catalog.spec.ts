import { describe, expect, it } from "vitest";

import { KnowledgeCatalog } from "../../src/catalog/knowledge-catalog.js";
import { KnowledgeAssetType } from "../../src/domain/knowledge-asset-type.js";
import { KnowledgeClassification } from "../../src/domain/knowledge-classification.js";
import { KnowledgeRepository } from "../../src/repository/knowledge-repository.js";
import { assetFixture, scopeFixture } from "../helpers/asset-fixture.js";

describe("Catalog Test — KnowledgeCatalog", () => {
  it("search() with no query returns every Asset", () => {
    const repository = new KnowledgeRepository();
    repository.save(assetFixture({ id: "a-1" }));
    repository.save(assetFixture({ id: "a-2" }));
    const catalog = new KnowledgeCatalog(repository);
    expect(catalog.search()).toHaveLength(2);
  });

  it("search() filters by assetType", () => {
    const repository = new KnowledgeRepository();
    const document = assetFixture({ id: "a-1" });
    repository.save(document);
    const catalog = new KnowledgeCatalog(repository);
    expect(catalog.search({ assetType: KnowledgeAssetType.DOCUMENT })).toHaveLength(1);
    expect(catalog.search({ assetType: KnowledgeAssetType.FAQ })).toHaveLength(0);
  });

  it("search() filters by classification", () => {
    const repository = new KnowledgeRepository();
    repository.save(assetFixture({ id: "a-1", classification: KnowledgeClassification.PUBLIC }));
    repository.save(assetFixture({ id: "a-2", classification: KnowledgeClassification.SECRET }));
    const catalog = new KnowledgeCatalog(repository);
    expect(catalog.search({ classification: KnowledgeClassification.SECRET })).toHaveLength(1);
  });

  it("search() filters by tenantId/workspaceId", () => {
    const repository = new KnowledgeRepository();
    repository.save(assetFixture({ id: "a-1", scope: scopeFixture({ tenantId: "tenant-a" }) }));
    repository.save(assetFixture({ id: "a-2", scope: scopeFixture({ tenantId: "tenant-b" }) }));
    const catalog = new KnowledgeCatalog(repository);
    expect(catalog.search({ tenantId: "tenant-a" })).toHaveLength(1);
    expect(catalog.search({ workspaceId: "workspace-1" })).toHaveLength(2);
  });

  it("search() filters by categoryId/tag/label", () => {
    const repository = new KnowledgeRepository();
    repository.save(
      assetFixture({ id: "a-1", categoryId: "cat-1", tags: ["urgent"], labels: ["env:prod"] }),
    );
    repository.save(assetFixture({ id: "a-2" }));
    const catalog = new KnowledgeCatalog(repository);
    expect(catalog.search({ categoryId: "cat-1" })).toHaveLength(1);
    expect(catalog.search({ tag: "urgent" })).toHaveLength(1);
    expect(catalog.search({ label: "env:prod" })).toHaveLength(1);
  });

  it("count() returns the number of matching Assets", () => {
    const repository = new KnowledgeRepository();
    repository.save(assetFixture({ id: "a-1" }));
    const catalog = new KnowledgeCatalog(repository);
    expect(catalog.count()).toBe(1);
    expect(catalog.count({ assetType: KnowledgeAssetType.FAQ })).toBe(0);
  });
});
