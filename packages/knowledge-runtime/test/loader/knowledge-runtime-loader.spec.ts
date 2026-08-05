import { KnowledgeRegistryBucket } from "@aos/knowledge-engine";
import { describe, expect, it } from "vitest";

import { KnowledgeAssetNotLoadedException } from "../../src/errors/knowledge-asset-not-loaded-exception.js";
import { KnowledgeRuntimeLoader } from "../../src/loader/knowledge-runtime-loader.js";
import { engineFixture } from "../helpers/engine-fixture.js";

function buildLoader(engine: Awaited<ReturnType<typeof engineFixture>>["engine"]) {
  return new KnowledgeRuntimeLoader(engine.repository, engine.catalog, engine.registry);
}

describe("Loader Test — KnowledgeRuntimeLoader", () => {
  it("loadById() reads a saved KnowledgeAsset", async () => {
    const { engine, asset } = await engineFixture();
    const loader = buildLoader(engine);
    expect(loader.loadById(asset.id)).toBe(asset);
  });

  it("loadById() throws KnowledgeAssetNotLoadedException for an unknown id", async () => {
    const { engine } = await engineFixture();
    const loader = buildLoader(engine);
    expect(() => loader.loadById("missing")).toThrow(KnowledgeAssetNotLoadedException);
  });

  it("loadByNamespace() reads a saved KnowledgeAsset by its namespace URI", async () => {
    const { engine, asset } = await engineFixture();
    const loader = buildLoader(engine);
    expect(loader.loadByNamespace(asset.namespace)).toBe(asset);
  });

  it("loadByNamespace() throws KnowledgeAssetNotLoadedException for an unknown namespace", async () => {
    const { engine } = await engineFixture();
    const loader = buildLoader(engine);
    expect(() => loader.loadByNamespace("knowledge://t/w/l/missing")).toThrow(
      KnowledgeAssetNotLoadedException,
    );
  });

  it("tryLoadById()/tryLoadByNamespace() return undefined instead of throwing", async () => {
    const { engine } = await engineFixture();
    const loader = buildLoader(engine);
    expect(loader.tryLoadById("missing")).toBeUndefined();
    expect(loader.tryLoadByNamespace("knowledge://t/w/l/missing")).toBeUndefined();
  });

  it("search() delegates to the Knowledge Catalog", async () => {
    const { engine, asset } = await engineFixture();
    const loader = buildLoader(engine);
    expect(loader.search({ tenantId: asset.scope.tenantId })).toContain(asset);
  });

  it("requireFromRegistry() reads an entry from the Knowledge Registry", async () => {
    const { engine } = await engineFixture();
    engine.registry.register(KnowledgeRegistryBucket.CATEGORY, { id: "cat-1" });
    const loader = buildLoader(engine);
    expect(loader.requireFromRegistry(KnowledgeRegistryBucket.CATEGORY, "cat-1")).toEqual({
      id: "cat-1",
    });
  });

  it("requireFromRegistry() throws KnowledgeAssetNotLoadedException for an unknown entry", async () => {
    const { engine } = await engineFixture();
    const loader = buildLoader(engine);
    expect(() => loader.requireFromRegistry(KnowledgeRegistryBucket.CATEGORY, "missing")).toThrow(
      KnowledgeAssetNotLoadedException,
    );
  });
});
