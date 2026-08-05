import type { KnowledgeRelationship } from "@aos/knowledge-engine";
import type { KnowledgeChunkReference, KnowledgeEmbeddingReference } from "@aos/knowledge-indexing";

import type { KnowledgeSearchMode } from "./knowledge-search-mode.js";

/**
 * "RESULT OBJECT" (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — the exact field list from
 * the prompt. A plain TS interface (not a Zod schema) since it embeds `KnowledgeRelationship`/
 * `KnowledgeChunkReference`/`KnowledgeEmbeddingReference` values sourced from
 * `@aos/knowledge-engine`/`@aos/knowledge-indexing`, mirroring the "plain interface for
 * composite read-model types" precedent set by `@aos/knowledge-runtime`'s
 * `KnowledgeRuntimeExecution`.
 */
export interface KnowledgeResult {
  readonly assetId: string;
  readonly version: string;
  readonly relationships: readonly KnowledgeRelationship[];
  readonly score: number;
  readonly confidence: number;
  readonly matchedFields: readonly string[];
  readonly matchedKeywords: readonly string[];
  readonly matchedMetadata: Readonly<Record<string, unknown>>;
  readonly matchedTags: readonly string[];
  readonly matchedCategories: readonly string[];
  readonly chunkRefs: readonly KnowledgeChunkReference[];
  readonly embeddingRefs: readonly KnowledgeEmbeddingReference[];
  readonly namespace: string;
  readonly policy?: string;
  readonly permission?: string;
  readonly source: string;
  readonly searchMode: KnowledgeSearchMode;
  readonly executionTimeMs: number;
}
