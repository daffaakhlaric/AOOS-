import type { KnowledgeQualityAssessmentRequest } from "../domain/knowledge-quality-assessment-request.js";
import type { KnowledgeQualityFinding } from "../domain/knowledge-quality-finding.js";

export interface KnowledgeQualityProviderFindingInput {
  readonly dimension: KnowledgeQualityFinding["dimension"];
  readonly severity: KnowledgeQualityFinding["severity"];
  readonly description: string;
  readonly locationReference?: string;
  readonly ruleId?: string;
}

export interface KnowledgeQualityProviderResult {
  readonly findings: readonly KnowledgeQualityProviderFindingInput[];
  readonly summary?: string;
}

/**
 * "IKnowledgeQualityProvider" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Extension
 * Points") — interface ONLY, never implemented in this package. The single seam through
 * which a caller-supplied OpenAI/Claude/Gemini/Ollama/... adapter performs the actual
 * quality assessment. "It ONLY orchestrates quality evaluation" — everything is
 * delegated through interfaces.
 */
export interface IKnowledgeQualityProvider {
  assess(request: KnowledgeQualityAssessmentRequest): Promise<KnowledgeQualityProviderResult>;
}
