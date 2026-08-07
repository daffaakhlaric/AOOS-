import type { KnowledgeGenerationRequest } from "../domain/knowledge-generation-request.js";

/**
 * "IKnowledgeGenerationStreamingProvider" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md —
 * "Extension Points") — interface ONLY. A future seam for a caller-supplied provider
 * that streams generation progress chunks (metadata strings only — never a real token
 * stream is implemented in this package).
 */
export interface IKnowledgeGenerationStreamingProvider {
  stream(request: KnowledgeGenerationRequest): AsyncIterable<string>;
}
