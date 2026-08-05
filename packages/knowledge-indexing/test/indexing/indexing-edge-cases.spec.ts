import { describe, expect, it } from "vitest";

import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { KnowledgeIndexEvents } from "../../src/events/knowledge-index-events.js";
import { KnowledgeIndexing } from "../../src/indexing/knowledge-indexing.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

function buildIndexing() {
  const { publisher } = fakePublisher();
  return new KnowledgeIndexing({ events: new KnowledgeIndexEvents(publisher) });
}

describe("Indexing Test — edge cases", () => {
  it("getEntry() returns undefined for an unknown id", () => {
    const indexing = buildIndexing();
    expect(indexing.getEntry("missing")).toBeUndefined();
  });

  it("listByAsset() returns an empty array for an unknown assetId", () => {
    const indexing = buildIndexing();
    expect(indexing.listByAsset("missing")).toEqual([]);
  });

  it("denies indexing when the Permission checker returns false", async () => {
    const { publisher } = fakePublisher();
    const indexing = new KnowledgeIndexing({
      events: new KnowledgeIndexEvents(publisher),
      config: { permissionChecker: { check: () => false } },
    });
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
