import type { EmbeddingResultMetadata } from "../domain/embedding-result-metadata.js";

/**
 * "FUTURE READINESS: Prepare interface-only contracts for ... 005.7P Knowledge
 * Recommendation. No implementation." (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md) — the
 * seam a future `@aos/knowledge-recommendation` package can implement to consume this
 * package's `EmbeddingResultMetadata` for candidate ranking. Interface ONLY — never
 * implemented here.
 */
export interface IKnowledgeRecommendationEmbeddingProvider {
  rankCandidates(
    resultMetadata: EmbeddingResultMetadata,
    candidateIds: readonly string[],
  ): Promise<readonly string[]>;
}
