import type { KnowledgeGenerationResult } from "../domain/knowledge-generation-result.js";

/**
 * "FUTURE READINESS: Prepare interface-only contracts for ... 005.7N Embedding Manager
 * ... No implementation." (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md) — the seam a
 * future `@aos/embedding-manager` (005.7N) will implement to embed a completed
 * `KnowledgeGenerationResult`. Never implemented in this package.
 */
export interface IEmbeddingManagerGenerator {
  embedResult(result: KnowledgeGenerationResult): Promise<void>;
}
