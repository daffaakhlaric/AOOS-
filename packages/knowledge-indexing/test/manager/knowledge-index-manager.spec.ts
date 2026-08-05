import { describe, expect, it } from "vitest";

import { KnowledgeIndexBuilder } from "../../src/builder/knowledge-index-builder.js";
import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { IndexNotFoundException } from "../../src/errors/index-not-found-exception.js";
import { KnowledgeIndexManager } from "../../src/manager/knowledge-index-manager.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Manager Test — KnowledgeIndexManager", () => {
  it("registerEntries() stores every Entry and updates Statistics per type", () => {
    const manager = new KnowledgeIndexManager();
    const asset = assetFixture({ tags: ["a", "b"] });
    const entries = new KnowledgeIndexBuilder().build(
      asset,
      KnowledgeIndexType.TAG,
      contextFixture(asset),
    );
    manager.registerEntries(entries);
    expect(manager.count()).toBe(2);
    expect(manager.statistics.get(KnowledgeIndexType.TAG).entryCount).toBe(2);
  });

  it("getEntry()/requireEntry() resolve a registered Entry", () => {
    const manager = new KnowledgeIndexManager();
    const asset = assetFixture();
    const [entry] = manager.registerEntries(
      new KnowledgeIndexBuilder().build(asset, KnowledgeIndexType.KEYWORD, contextFixture(asset)),
    );
    expect(manager.getEntry(entry!.id)).toBe(entry);
    expect(manager.requireEntry(entry!.id)).toBe(entry);
  });

  it("requireEntry() throws IndexNotFoundException for an unknown id", () => {
    const manager = new KnowledgeIndexManager();
    expect(() => manager.requireEntry("missing")).toThrow(IndexNotFoundException);
  });

  it("listByAsset() returns every Entry for that assetId", () => {
    const manager = new KnowledgeIndexManager();
    const asset = assetFixture({ tags: ["a", "b"] });
    manager.registerEntries(
      new KnowledgeIndexBuilder().build(asset, KnowledgeIndexType.TAG, contextFixture(asset)),
    );
    expect(manager.listByAsset(asset.id)).toHaveLength(2);
  });

  it("removeEntriesForAsset() removes every Entry for that assetId and updates Statistics", () => {
    const manager = new KnowledgeIndexManager();
    const asset = assetFixture({ tags: ["a", "b"] });
    manager.registerEntries(
      new KnowledgeIndexBuilder().build(asset, KnowledgeIndexType.TAG, contextFixture(asset)),
    );
    const removed = manager.removeEntriesForAsset(asset.id);
    expect(removed).toBe(2);
    expect(manager.count()).toBe(0);
    expect(manager.statistics.get(KnowledgeIndexType.TAG).entryCount).toBe(0);
  });

  it("exposes a working Scheduler", () => {
    const manager = new KnowledgeIndexManager();
    const job = manager.scheduler.reindex("a-1");
    expect(job.status).toBe("pending");
  });
});
