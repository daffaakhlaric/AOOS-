import { describe, expect, it } from "vitest";

import { KnowledgeIndexingSystem } from "../../src/bootstrap/knowledge-indexing-system.js";
import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("Bootstrap Test — KnowledgeIndexingSystem", () => {
  it("exposes name/version and wraps a working KnowledgeIndexing", async () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeIndexingSystem(publisher);

    expect(system.name).toBe("KnowledgeIndexingSystemModule");
    expect(system.version).toBe("0.1.0");

    const asset = assetFixture();
    const entries = await system.indexing.indexAsset({
      asset,
      context: contextFixture(asset),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    });
    expect(entries).toHaveLength(1);
  });

  it("accepts an optional KnowledgeIndexingConfig", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeIndexingSystem(publisher, { policyChecker: { check: () => true } });
    expect(system.indexing).toBeDefined();
  });

  it("onBootstrap()/onShutdown() resolve without error", async () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeIndexingSystem(publisher);
    await expect(system.onBootstrap()).resolves.toBeUndefined();
    await expect(system.onShutdown()).resolves.toBeUndefined();
  });
});
