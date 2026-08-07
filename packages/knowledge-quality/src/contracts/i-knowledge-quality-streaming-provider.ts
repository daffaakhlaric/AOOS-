import type { KnowledgeQualityAssessmentRequest } from "../domain/knowledge-quality-assessment-request.js";

/**
 * "IKnowledgeQualityStreamingProvider" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md —
 * "Extension Points") — interface ONLY. A future seam for a caller-supplied provider
 * that streams assessment progress chunks (metadata strings only — never a real token
 * stream is implemented in this package).
 */
export interface IKnowledgeQualityStreamingProvider {
  stream(request: KnowledgeQualityAssessmentRequest): AsyncIterable<string>;
}
