import type { KnowledgeValidationAudit } from "../domain/knowledge-validation-audit.js";

/**
 * "IKnowledgeValidationAuditProvider" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md —
 * "Extension Points") — interface ONLY. A future seam for a caller-supplied external
 * audit sink that mirrors every `KnowledgeValidationAudit` entry this package appends.
 */
export interface IKnowledgeValidationAuditProvider {
  record(audit: KnowledgeValidationAudit): Promise<void>;
}
