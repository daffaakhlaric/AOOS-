import type { KnowledgeGenerationRequest } from "../domain/knowledge-generation-request.js";

/**
 * "IKnowledgeGenerationCostProvider" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md —
 * "Extension Points") — interface ONLY. A future seam for a caller-supplied cost
 * estimator over a `KnowledgeGenerationRequest`.
 */
export interface IKnowledgeGenerationCostProvider {
  estimateCost(request: KnowledgeGenerationRequest): Promise<number>;
}
