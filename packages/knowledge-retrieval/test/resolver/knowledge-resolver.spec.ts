import { KnowledgeAssetType, KnowledgeTemplateCategory } from "@aos/knowledge-engine";
import { KnowledgeIndexType } from "@aos/knowledge-indexing";
import { describe, expect, it } from "vitest";

import { KnowledgeResolver } from "../../src/resolver/knowledge-resolver.js";
import { engineFixture } from "../helpers/engine-fixture.js";

async function resolverFixture() {
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
  return { engine, resolver, asset };
}

describe("KnowledgeResolver", () => {
  it("resolveAsset() returns the saved asset", async () => {
    const { resolver, asset } = await resolverFixture();
    expect(resolver.resolveAsset(asset.id)).toEqual(asset);
  });

  it("resolveAsset() throws for an unknown assetId", async () => {
    const { resolver } = await resolverFixture();
    expect(() => resolver.resolveAsset("missing")).toThrow();
  });

  it("tryResolveAsset() returns undefined for an unknown assetId", async () => {
    const { resolver } = await resolverFixture();
    expect(resolver.tryResolveAsset("missing")).toBeUndefined();
  });

  it("tryResolveAsset() returns the asset when it exists", async () => {
    const { resolver, asset } = await resolverFixture();
    expect(resolver.tryResolveAsset(asset.id)).toEqual(asset);
  });

  it("resolveRelationships() returns an array", async () => {
    const { resolver, asset } = await resolverFixture();
    expect(Array.isArray(resolver.resolveRelationships(asset.id))).toBe(true);
  });

  it("resolveVersionHistory() returns an array", async () => {
    const { resolver, asset } = await resolverFixture();
    expect(Array.isArray(resolver.resolveVersionHistory(asset.id))).toBe(true);
  });

  it("resolveIndexEntriesByAsset() returns the entries indexed for that asset", async () => {
    const { resolver, asset } = await resolverFixture();
    const entries = resolver.resolveIndexEntriesByAsset(asset.id);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("resolveIndexEntriesByType() returns entries for a given index type", async () => {
    const { resolver } = await resolverFixture();
    const entries = resolver.resolveIndexEntriesByType(KnowledgeIndexType.KEYWORD);
    expect(Array.isArray(entries)).toBe(true);
  });

  it("resolveTemplate() returns a registered template", async () => {
    const { engine, resolver } = await resolverFixture();
    engine.templateEngine.register({
      id: "template-1",
      name: "Template 1",
      category: KnowledgeTemplateCategory.FAQ,
      assetType: KnowledgeAssetType.SUPPORT,
      version: "1.0.0",
      createdAt: new Date().toISOString(),
    });
    expect(resolver.resolveTemplate("template-1").id).toBe("template-1");
  });

  it("resolveTemplate() throws for an unknown templateId", async () => {
    const { resolver } = await resolverFixture();
    expect(() => resolver.resolveTemplate("missing")).toThrow();
  });

  it("exposes the underlying KnowledgePolicyEngine via .policy", async () => {
    const { resolver } = await resolverFixture();
    expect(resolver.policy).toBeDefined();
  });

  it("exposes the underlying KnowledgePermissionEngine via .permission", async () => {
    const { resolver } = await resolverFixture();
    expect(resolver.permission).toBeDefined();
  });
});
