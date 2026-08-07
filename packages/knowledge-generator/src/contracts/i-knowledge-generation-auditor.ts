import type { KnowledgeGenerationAudit } from "../domain/knowledge-generation-audit.js";

/**
 * "IKnowledgeGenerationAuditor" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md —
 * "Extension Points") — interface ONLY. A future seam for a caller-supplied external
 * audit sink that mirrors every `KnowledgeGenerationAudit` entry this package appends.
 */
export interface IKnowledgeGenerationAuditor {
  record(audit: KnowledgeGenerationAudit): Promise<void>;
}
