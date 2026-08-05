import {
  KnowledgeAssetType,
  KnowledgeClassification,
  KnowledgeLifecycleState,
} from "@aos/knowledge-engine";
import { describe, expect, it } from "vitest";

import { EMPTY_KNOWLEDGE_FILTER_SET } from "../../src/domain/knowledge-filter-set.js";
import { KnowledgeFilter } from "../../src/filter/knowledge-filter.js";
import { KnowledgeResolver } from "../../src/resolver/knowledge-resolver.js";
import { engineFixture } from "../helpers/engine-fixture.js";
import { resultFixture } from "../helpers/result-fixture.js";

async function filterFixture() {
  const { engine, indexing, asset } = await engineFixture();
  const resolver = new KnowledgeResolver(
    engine.repository,
    engine.relationshipEngine,
    engine.policyEngine,
    engine.permissionEngine,
    engine.versionEngine,
    engine.templateEngine,
    indexing.resolver,
  );
  return { filter: new KnowledgeFilter(resolver), asset };
}

describe("KnowledgeFilter", () => {
  it("returns results unchanged when no structural filter is set", async () => {
    const { filter, asset } = await filterFixture();
    const results = [resultFixture(asset)];
    expect(filter.apply(results, EMPTY_KNOWLEDGE_FILTER_SET)).toBe(results);
  });

  it("keeps a Result whose Asset matches the workspaceId filter", async () => {
    const { filter, asset } = await filterFixture();
    const results = filter.apply([resultFixture(asset)], { workspaceId: asset.scope.workspaceId });
    expect(results).toHaveLength(1);
  });

  it("excludes a Result whose Asset does not match the workspaceId filter", async () => {
    const { filter, asset } = await filterFixture();
    const results = filter.apply([resultFixture(asset)], { workspaceId: "other-workspace" });
    expect(results).toHaveLength(0);
  });

  it("excludes a Result whose Asset cannot be resolved, once any filter is set", async () => {
    const { filter, asset } = await filterFixture();
    const orphaned = resultFixture(asset, { assetId: "missing" });
    expect(filter.apply([orphaned], { workspaceId: asset.scope.workspaceId })).toEqual([]);
  });

  it("filters by tenantId", async () => {
    const { filter, asset } = await filterFixture();
    expect(filter.apply([resultFixture(asset)], { tenantId: "other-tenant" })).toEqual([]);
    expect(filter.apply([resultFixture(asset)], { tenantId: asset.scope.tenantId })).toHaveLength(
      1,
    );
  });

  it("filters by departmentId", async () => {
    const { filter, asset } = await filterFixture();
    expect(filter.apply([resultFixture(asset)], { departmentId: "department-1" })).toEqual([]);
  });

  it("filters by classification", async () => {
    const { filter, asset } = await filterFixture();
    expect(
      filter.apply([resultFixture(asset)], { classification: KnowledgeClassification.INTERNAL }),
    ).toHaveLength(1);
    expect(
      filter.apply([resultFixture(asset)], { classification: KnowledgeClassification.RESTRICTED }),
    ).toEqual([]);
  });

  it("filters by language via asset metadata", async () => {
    const { filter, asset } = await filterFixture();
    expect(filter.apply([resultFixture(asset)], { language: "fr" })).toEqual([]);
  });

  it("filters by region via asset metadata", async () => {
    const { filter, asset } = await filterFixture();
    expect(filter.apply([resultFixture(asset)], { region: "eu" })).toEqual([]);
  });

  it("filters by categoryId", async () => {
    const { filter, asset } = await filterFixture();
    expect(filter.apply([resultFixture(asset)], { categoryId: "category-x" })).toEqual([]);
  });

  it("filters by tags — every requested tag must be present", async () => {
    const { filter, asset } = await filterFixture();
    expect(filter.apply([resultFixture(asset)], { tags: ["not-present"] })).toEqual([]);
  });

  it("filters by version", async () => {
    const { filter, asset } = await filterFixture();
    const version = `${asset.version.major}.${asset.version.minor}.${asset.version.patch}`;
    expect(filter.apply([resultFixture(asset)], { version })).toHaveLength(1);
    expect(filter.apply([resultFixture(asset)], { version: "99.99.99" })).toEqual([]);
  });

  it("filters by templateId", async () => {
    const { filter, asset } = await filterFixture();
    expect(filter.apply([resultFixture(asset)], { templateId: "template-x" })).toEqual([]);
  });

  it("filters by source", async () => {
    const { filter, asset } = await filterFixture();
    expect(filter.apply([resultFixture(asset)], { source: "not-the-source" })).toEqual([]);
  });

  it("filters by assetType — matching passes, mismatched excludes", async () => {
    const { filter, asset } = await filterFixture();
    expect(
      filter.apply([resultFixture(asset)], { assetType: KnowledgeAssetType.SUPPORT }),
    ).toHaveLength(1);
    expect(filter.apply([resultFixture(asset)], { assetType: KnowledgeAssetType.PRODUCT })).toEqual(
      [],
    );
  });

  it("filters by lifecycleState", async () => {
    const { filter, asset } = await filterFixture();
    expect(
      filter.apply([resultFixture(asset)], { lifecycleState: KnowledgeLifecycleState.DELETED }),
    ).toEqual([]);
  });
});
