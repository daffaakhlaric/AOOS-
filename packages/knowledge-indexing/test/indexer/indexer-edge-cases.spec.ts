import { describe, expect, it } from "vitest";

import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
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

describe("Indexer Test — edge cases", () => {
  it("removeAsset() reports 0 removed and still publishes DELETED when nothing was indexed", async () => {
    const { indexer, publish } = buildIndexer();
    const asset = assetFixture();
    const removed = await indexer.removeAsset(asset.id, contextFixture(asset));
    expect(removed).toBe(0);
    expect(publish).toHaveBeenCalledOnce();
  });

  it("indexAsset() carries supplied relationships through to the RELATIONSHIP Index Entry", async () => {
    const { indexer } = buildIndexer();
    const asset = assetFixture();
    const entries = await indexer.indexAsset({
      asset,
      context: contextFixture(asset),
      indexTypes: [KnowledgeIndexType.RELATIONSHIP],
      relationships: [{ id: "r-1" } as never],
    });
    expect(entries[0]?.value).toEqual({ relationshipCount: 1 });
  });
});
