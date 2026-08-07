import type { KnowledgeGenerationResult } from "../domain/knowledge-generation-result.js";

/**
 * "IKnowledgeGenerationCache" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Extension
 * Points") — interface ONLY. A future seam for a caller-supplied cache of
 * `KnowledgeGenerationResult` metadata keyed by a cache key the caller derives.
 */
export interface IKnowledgeGenerationCache {
  get(key: string): Promise<KnowledgeGenerationResult | undefined>;
  set(key: string, result: KnowledgeGenerationResult): Promise<void>;
}
