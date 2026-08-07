import type { KnowledgeGenerationRequest } from "../domain/knowledge-generation-request.js";

/**
 * "IKnowledgeGenerationOptimizer" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md —
 * "Extension Points") — interface ONLY. A future seam for a caller-supplied optimizer
 * that rewrites/tunes a `KnowledgeGenerationRequest` before it is handed to a Provider.
 */
export interface IKnowledgeGenerationOptimizer {
  optimize(request: KnowledgeGenerationRequest): Promise<KnowledgeGenerationRequest>;
}
