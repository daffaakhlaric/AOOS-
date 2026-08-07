import type { KnowledgeGenerationRequest } from "../domain/knowledge-generation-request.js";
import type { KnowledgeGenerationResult } from "../domain/knowledge-generation-result.js";

/**
 * "IKnowledgeGenerationProvider" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md —
 * "Extension Points") — interface ONLY, never implemented in this package. The single
 * seam through which a caller-supplied OpenAI/Claude/Gemini/Ollama/... adapter performs
 * the actual generation. "Everything is delegated through interfaces."
 */
export interface IKnowledgeGenerationProvider {
  generate(request: KnowledgeGenerationRequest): Promise<KnowledgeGenerationResult>;
}
