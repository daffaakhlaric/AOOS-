import { describe, expect, it } from "vitest";

import { KnowledgeIndexManager } from "../../src/manager/knowledge-index-manager.js";

describe("Manager Test — edge cases", () => {
  it("registerEntries() with an empty array is a no-op", () => {
    const manager = new KnowledgeIndexManager();
    expect(manager.registerEntries([])).toEqual([]);
    expect(manager.count()).toBe(0);
  });

  it("removeEntriesForAsset() returns 0 for an unknown assetId", () => {
    const manager = new KnowledgeIndexManager();
    expect(manager.removeEntriesForAsset("missing")).toBe(0);
  });

  it("getEntry() returns undefined for an unknown id", () => {
    const manager = new KnowledgeIndexManager();
    expect(manager.getEntry("missing")).toBeUndefined();
  });

  it("listByAsset() returns an empty array for an unknown assetId", () => {
    const manager = new KnowledgeIndexManager();
    expect(manager.listByAsset("missing")).toEqual([]);
  });
});
