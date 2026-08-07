import type { KnowledgeValidationReport } from "../domain/knowledge-validation-report.js";

/**
 * "FUTURE READINESS: Prepare interface-only contracts for ... 005.7N Embedding Manager
 * ... No implementation." (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md) — the seam a
 * future `@aos/embedding-manager` (005.7N) will implement to embed a settled
 * `KnowledgeValidationReport`. Never implemented in this package.
 */
export interface IEmbeddingManagerValidator {
  embedReport(report: KnowledgeValidationReport): Promise<void>;
}
