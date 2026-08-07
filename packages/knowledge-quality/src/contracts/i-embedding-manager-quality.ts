import type { KnowledgeQualityReport } from "../domain/knowledge-quality-report.js";

/**
 * "FUTURE READINESS: Prepare interface-only contracts for ... 005.7N Embedding Manager
 * ... No implementation." (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md) — the seam a
 * future `@aos/embedding-manager` (005.7N) will implement to embed a completed
 * `KnowledgeQualityReport`. Never implemented in this package.
 */
export interface IEmbeddingManagerQuality {
  embedReport(report: KnowledgeQualityReport): Promise<void>;
}
