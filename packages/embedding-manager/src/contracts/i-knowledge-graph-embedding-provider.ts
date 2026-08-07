import type { EmbeddingResultMetadata } from "../domain/embedding-result-metadata.js";

/**
 * "FUTURE READINESS: Prepare interface-only contracts for 005.7O Knowledge Graph...
 * No implementation." (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md) — the seam a future
 * `@aos/knowledge-graph` package can implement to consume this package's
 * `EmbeddingResultMetadata` when linking graph nodes to embedding results. Interface
 * ONLY — never implemented here.
 */
export interface IKnowledgeGraphEmbeddingProvider {
  linkEmbeddingToNode(resultMetadata: EmbeddingResultMetadata, nodeId: string): Promise<void>;
}
