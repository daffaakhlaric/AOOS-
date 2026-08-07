import type { KnowledgeQualityAssessmentRequest } from "../domain/knowledge-quality-assessment-request.js";
import type { KnowledgeQualityDimension } from "../domain/knowledge-quality-dimension.js";

export interface KnowledgeQualityScoreInput {
  readonly dimension: KnowledgeQualityDimension;
  readonly value?: number;
  readonly qualitativeValue?: string;
  readonly providerId: string;
}

/**
 * "IKnowledgeQualityScoringProvider" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md —
 * "Extension Points") — interface ONLY, never implemented in this package. The seam
 * through which a caller-supplied scoring adapter reports a numeric/qualitative score
 * per Quality Dimension. This package NEVER computes a score itself — it only records
 * what this interface reports, as a `KnowledgeQualityScoreMetadata` entry.
 */
export interface IKnowledgeQualityScoringProvider {
  score(request: KnowledgeQualityAssessmentRequest): Promise<readonly KnowledgeQualityScoreInput[]>;
}
