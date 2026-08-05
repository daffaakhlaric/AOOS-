import type { KnowledgeRelationship } from "@aos/knowledge-engine";
import type { KnowledgeChunkReference, KnowledgeEmbeddingReference } from "@aos/knowledge-indexing";

import type { KnowledgeResult } from "../domain/knowledge-result.js";
import type { KnowledgeSearchMode } from "../domain/knowledge-search-mode.js";

export interface CreateResultInput {
  readonly assetId: string;
  readonly version: string;
  readonly namespace: string;
  readonly searchMode: KnowledgeSearchMode;
  readonly source: string;
  readonly score?: number;
  readonly confidence?: number;
  readonly relationships?: readonly KnowledgeRelationship[];
  readonly matchedFields?: readonly string[];
  readonly matchedKeywords?: readonly string[];
  readonly matchedMetadata?: Readonly<Record<string, unknown>>;
  readonly matchedTags?: readonly string[];
  readonly matchedCategories?: readonly string[];
  readonly chunkRefs?: readonly KnowledgeChunkReference[];
  readonly embeddingRefs?: readonly KnowledgeEmbeddingReference[];
  readonly policy?: string;
  readonly permission?: string;
  readonly executionTimeMs?: number;
}

/** Builds a fresh `KnowledgeResult` — a pure data transformation, no scoring/ranking logic. */
export class KnowledgeResultFactory {
  create(input: CreateResultInput): KnowledgeResult {
    return {
      assetId: input.assetId,
      version: input.version,
      relationships: input.relationships ?? [],
      score: input.score ?? 0,
      confidence: input.confidence ?? 0,
      matchedFields: input.matchedFields ?? [],
      matchedKeywords: input.matchedKeywords ?? [],
      matchedMetadata: input.matchedMetadata ?? {},
      matchedTags: input.matchedTags ?? [],
      matchedCategories: input.matchedCategories ?? [],
      chunkRefs: input.chunkRefs ?? [],
      embeddingRefs: input.embeddingRefs ?? [],
      namespace: input.namespace,
      policy: input.policy,
      permission: input.permission,
      source: input.source,
      searchMode: input.searchMode,
      executionTimeMs: input.executionTimeMs ?? 0,
    };
  }
}
