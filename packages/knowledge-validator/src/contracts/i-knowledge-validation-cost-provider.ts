import type { KnowledgeValidationRequest } from "../domain/knowledge-validation-request.js";

/**
 * "IKnowledgeValidationCostProvider" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md —
 * "Extension Points") — interface ONLY. A future seam for a caller-supplied cost
 * estimator over a `KnowledgeValidationRequest`.
 */
export interface IKnowledgeValidationCostProvider {
  estimateCost(request: KnowledgeValidationRequest): Promise<number>;
}
