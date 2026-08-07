import type { KnowledgeQualityReport } from "../domain/knowledge-quality-report.js";

/**
 * "FUTURE READINESS: Prepare interface-only contracts for ... 005.7M Knowledge
 * Validator AI ... No implementation." (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md) —
 * the seam a future `@aos/knowledge-validator-ai` (005.7M) will implement to
 * cross-validate a completed `KnowledgeQualityReport`. Never implemented in this
 * package.
 */
export interface IKnowledgeValidatorAiQuality {
  validateReport(report: KnowledgeQualityReport): Promise<boolean>;
}
