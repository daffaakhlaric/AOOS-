import { describe, expect, it } from "vitest";

import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { KnowledgeIndexEventType } from "../../src/events/knowledge-index-event-type.js";
import { KnowledgeIndexEvents } from "../../src/events/knowledge-index-events.js";
import { KnowledgeIndexer } from "../../src/indexer/knowledge-indexer.js";
import { KnowledgeIndexManager } from "../../src/manager/knowledge-index-manager.js";
import { KnowledgeIndexMetrics } from "../../src/metrics/knowledge-index-metrics.js";
import { KnowledgeIndexValidator } from "../../src/validator/knowledge-index-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

function buildIndexer() {
  const manager = new KnowledgeIndexManager();
  const { publisher, publish } = fakePublisher();
  const indexer = new KnowledgeIndexer(
    new KnowledgeIndexValidator(),
    manager,
    new KnowledgeIndexMetrics(),
    new KnowledgeIndexEvents(publisher),
  );
  return { indexer, manager, publish };
}

describe("Indexer Test — KnowledgeIndexer", () => {
  it("indexAsset() builds/registers entries and publishes CREATED the first time", async () => {
    const { indexer, manager, publish } = buildIndexer();
    const asset = assetFixture({ tags: ["a"] });
    const entries = await indexer.indexAsset({
      asset,
      context: contextFixture(asset),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    });
    expect(entries).toHaveLength(1);
    expect(manager.count()).toBe(1);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeIndexEventType.CREATED,
    );
  });

  it("indexAsset() publishes UPDATED for an already-indexed asset", async () => {
    const { indexer, publish } = buildIndexer();
    const asset = assetFixture();
    const input = {
      asset,
      context: contextFixture(asset),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    };
    await indexer.indexAsset(input);
    await indexer.indexAsset(input);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeIndexEventType.UPDATED,
    );
  });

  it("indexAsset() publishes FAILED and rethrows for an invalid Asset", async () => {
    const { indexer, publish } = buildIndexer();
    const asset = { ...assetFixture(), namespace: "not-a-namespace" };
    await expect(
      indexer.indexAsset({
        asset,
        context: contextFixture(asset),
        indexTypes: [KnowledgeIndexType.KEYWORD],
      }),
    ).rejects.toThrow();
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeIndexEventType.FAILED,
    );
  });

  it("removeAsset() removes every Entry and publishes DELETED", async () => {
    const { indexer, manager, publish } = buildIndexer();
    const asset = assetFixture();
    await indexer.indexAsset({
      asset,
      context: contextFixture(asset),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    });
    const removed = await indexer.removeAsset(asset.id, contextFixture(asset));
    expect(removed).toBe(1);
    expect(manager.count()).toBe(0);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeIndexEventType.DELETED,
    );
  });

  it("reindexAsset() removes existing entries, rebuilds, and publishes REBUILT", async () => {
    const { indexer, manager, publish } = buildIndexer();
    const asset = assetFixture();
    await indexer.indexAsset({
      asset,
      context: contextFixture(asset),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    });
    const entries = await indexer.reindexAsset({
      asset,
      context: contextFixture(asset),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    });
    expect(entries).toHaveLength(1);
    expect(manager.count()).toBe(1);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeIndexEventType.REBUILT,
    );
  });

  it("indexAsset() defaults to every KnowledgeIndexType except EMBEDDING_REFERENCE when indexTypes is omitted", async () => {
    const { indexer } = buildIndexer();
    const asset = assetFixture({ tags: ["a"] });
    const entries = await indexer.indexAsset({ asset, context: contextFixture(asset) });
    expect(
      entries.some((entry) => entry.indexType === KnowledgeIndexType.EMBEDDING_REFERENCE),
    ).toBe(false);
    expect(entries.length).toBeGreaterThan(1);
  });
});
