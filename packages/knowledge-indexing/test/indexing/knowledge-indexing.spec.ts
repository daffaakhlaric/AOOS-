import { describe, expect, it, vi } from "vitest";

import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { IndexOptimizationNotSupportedException } from "../../src/errors/index-optimization-not-supported-exception.js";
import { KnowledgeIndexEvents } from "../../src/events/knowledge-index-events.js";
import { KnowledgeIndexing } from "../../src/indexing/knowledge-indexing.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

function buildIndexing(config?: ConstructorParameters<typeof KnowledgeIndexing>[0]["config"]) {
  const { publisher } = fakePublisher();
  return new KnowledgeIndexing({ events: new KnowledgeIndexEvents(publisher), config });
}

describe("Indexing Test — KnowledgeIndexing", () => {
  it("indexAsset() builds and registers entries", async () => {
    const indexing = buildIndexing();
    const asset = assetFixture({ tags: ["a"] });
    const entries = await indexing.indexAsset({
      asset,
      context: contextFixture(asset),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    });
    expect(entries).toHaveLength(1);
    expect(indexing.getEntry(entries[0]!.id)).toEqual(entries[0]);
  });

  it("reindexAsset() rebuilds entries for an already-indexed Asset", async () => {
    const indexing = buildIndexing();
    const asset = assetFixture();
    await indexing.indexAsset({
      asset,
      context: contextFixture(asset),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    });
    const entries = await indexing.reindexAsset({
      asset,
      context: contextFixture(asset),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    });
    expect(entries).toHaveLength(1);
  });

  it("removeAsset() removes every Entry for an Asset", async () => {
    const indexing = buildIndexing();
    const asset = assetFixture();
    await indexing.indexAsset({
      asset,
      context: contextFixture(asset),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    });
    const removed = await indexing.removeAsset(asset.id, contextFixture(asset));
    expect(removed).toBe(1);
  });

  it("requireEntry() and listByAsset() delegate to the Manager", async () => {
    const indexing = buildIndexing();
    const asset = assetFixture();
    const [entry] = await indexing.indexAsset({
      asset,
      context: contextFixture(asset),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    });
    expect(indexing.requireEntry(entry!.id)).toEqual(entry);
    expect(indexing.listByAsset(asset.id)).toHaveLength(1);
  });

  it("health()/metrics()/monitorSnapshot() reflect current Indexing state", async () => {
    const indexing = buildIndexing();
    const asset = assetFixture();
    await indexing.indexAsset({
      asset,
      context: contextFixture(asset),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    });
    expect(indexing.health().status).toBe("healthy");
    expect(indexing.metrics().indexCount).toBe(1);
    expect(indexing.monitorSnapshot().index.count).toBe(1);
  });

  it("exposes manager/factory/validator/resolver/optimizer/indexer", () => {
    const indexing = buildIndexing();
    expect(indexing.manager).toBeDefined();
    expect(indexing.factory).toBeDefined();
    expect(indexing.validator).toBeDefined();
    expect(indexing.resolver).toBeDefined();
    expect(indexing.optimizer).toBeDefined();
    expect(indexing.indexer).toBeDefined();
  });

  it("optimizer throws IndexOptimizationNotSupportedException by default, but delegates when configured", async () => {
    const indexing = buildIndexing();
    await expect(indexing.optimizer.merge("keyword")).rejects.toThrow(
      IndexOptimizationNotSupportedException,
    );

    const provider = {
      merge: vi.fn(async () => {}),
      split: vi.fn(),
      compact: vi.fn(),
      vacuum: vi.fn(),
      rebuild: vi.fn(),
    };
    const configured = buildIndexing({ optimizerProvider: provider as never });
    await configured.optimizer.merge("keyword");
    expect(provider.merge).toHaveBeenCalledWith("keyword");
  });

  it("respects a configured Policy checker", async () => {
    const indexing = buildIndexing({ policyChecker: { check: () => false } });
    const asset = assetFixture();
    await expect(
      indexing.indexAsset({
        asset,
        context: contextFixture(asset),
        indexTypes: [KnowledgeIndexType.KEYWORD],
      }),
    ).rejects.toThrow();
  });
});
