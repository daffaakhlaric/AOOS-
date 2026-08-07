import type { KnowledgeValidationRequest } from "../domain/knowledge-validation-request.js";

/**
 * "IKnowledgeValidationStreamingProvider" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md —
 * "Extension Points") — interface ONLY. A future seam for a caller-supplied provider
 * that streams validation progress chunks (metadata strings only — never a real token
 * stream is implemented in this package).
 */
export interface IKnowledgeValidationStreamingProvider {
  stream(request: KnowledgeValidationRequest): AsyncIterable<string>;
}
