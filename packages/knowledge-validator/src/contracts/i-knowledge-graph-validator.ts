import type { KnowledgeValidationRecord } from "../domain/knowledge-validation-record.js";

/**
 * "FUTURE READINESS: Prepare interface-only contracts for ... 005.7O Knowledge Graph
 * ... No implementation." (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md) — the seam a
 * future `@aos/knowledge-graph` (005.7O) will implement to link a settled Validation
 * into its graph of knowledge relationships. Never implemented in this package — a
 * documented "genuinely obviously needed" extra contract beyond the 12 required
 * Extension Points, see docs/005.7M-KNOWLEDGE-VALIDATOR-AI-REPORT.md — "Readiness
 * Checklist for 005.7N".
 */
export interface IKnowledgeGraphValidator {
  linkValidation(record: KnowledgeValidationRecord): Promise<void>;
}
