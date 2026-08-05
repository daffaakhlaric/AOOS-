import { describe, expect, it } from "vitest";

import type { KnowledgeResult } from "../../src/domain/knowledge-result.js";
import { KnowledgeSearchMode } from "../../src/domain/knowledge-search-mode.js";

describe("KnowledgeResult", () => {
  it("accepts a fully populated object shape", () => {
    const result: KnowledgeResult = {
      assetId: "asset-1",
      version: "1.0.0",
      relationships: [],
      score: 0.9,
      confidence: 0.8,
      matchedFields: ["title"],
      matchedKeywords: ["hello"],
      matchedMetadata: {},
      matchedTags: [],
      matchedCategories: [],
      chunkRefs: [],
      embeddingRefs: [],
      namespace: "knowledge://tenant-1/workspace-1/library-1/doc-1",
      source: "keyword-provider",
      searchMode: KnowledgeSearchMode.KEYWORD,
      executionTimeMs: 12,
    };
    expect(result.assetId).toBe("asset-1");
    expect(result.policy).toBeUndefined();
    expect(result.permission).toBeUndefined();
  });
});
