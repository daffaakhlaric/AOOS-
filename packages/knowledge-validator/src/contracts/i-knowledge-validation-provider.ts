import type { KnowledgeValidationFinding } from "../domain/knowledge-validation-finding.js";
import type { KnowledgeValidationRequest } from "../domain/knowledge-validation-request.js";

export interface KnowledgeValidationProviderFindingInput {
  readonly category: KnowledgeValidationFinding["category"];
  readonly severity: KnowledgeValidationFinding["severity"];
  readonly description: string;
  readonly locationReference?: string;
  readonly ruleId?: string;
}

export interface KnowledgeValidationProviderResult {
  readonly findings: readonly KnowledgeValidationProviderFindingInput[];
  readonly summary?: string;
}

/**
 * "IKnowledgeValidationProvider" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md —
 * "Extension Points") — interface ONLY, never implemented in this package. The single
 * seam through which a caller-supplied OpenAI/Claude/Gemini/Ollama/... adapter performs
 * the actual knowledge validation. This package "MUST NEVER perform AI validation
 * directly" — everything is delegated through interfaces.
 */
export interface IKnowledgeValidationProvider {
  validate(request: KnowledgeValidationRequest): Promise<KnowledgeValidationProviderResult>;
}
