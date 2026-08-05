import type { KnowledgeAsset } from "@aos/knowledge-engine";

import type { KnowledgeResult } from "../../src/domain/knowledge-result.js";
import { KnowledgeSearchMode } from "../../src/domain/knowledge-search-mode.js";

export function resultFixture(
  asset: KnowledgeAsset,
  overrides: Partial<KnowledgeResult> = {},
): KnowledgeResult {
  return {
    assetId: asset.id,
    version: `${asset.version.major}.${asset.version.minor}.${asset.version.patch}`,
    relationships: [],
    score: 1,
    confidence: 1,
    matchedFields: [],
    matchedKeywords: [],
    matchedMetadata: {},
    matchedTags: [],
    matchedCategories: [],
    chunkRefs: [],
    embeddingRefs: [],
    namespace: asset.namespace,
    source: "fixture",
    searchMode: KnowledgeSearchMode.KEYWORD,
    executionTimeMs: 1,
    ...overrides,
  };
}
