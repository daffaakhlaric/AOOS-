import type { KnowledgeQualityAssessmentRequest } from "../domain/knowledge-quality-assessment-request.js";

/**
 * "IKnowledgeQualityCostProvider" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Extension
 * Points") — interface ONLY. A future seam for a caller-supplied cost estimator over a
 * `KnowledgeQualityAssessmentRequest`.
 */
export interface IKnowledgeQualityCostProvider {
  estimateCost(request: KnowledgeQualityAssessmentRequest): Promise<number>;
}
