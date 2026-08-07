import type { KnowledgeQualityAssessmentAudit } from "../domain/knowledge-quality-assessment-audit.js";

/**
 * "IKnowledgeQualityAuditProvider" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md —
 * "Extension Points") — interface ONLY. A future seam for a caller-supplied external
 * audit sink that mirrors every `KnowledgeQualityAssessmentAudit` entry this package
 * appends.
 */
export interface IKnowledgeQualityAuditProvider {
  record(audit: KnowledgeQualityAssessmentAudit): Promise<void>;
}
