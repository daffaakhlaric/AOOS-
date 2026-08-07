/**
 * "QUALITY DIMENSIONS: Support metadata for Accuracy, Completeness, Consistency,
 * Clarity, Readability, Structure, Freshness, Compliance, Relevance, Traceability,
 * Confidence, Risk. Metadata ONLY. No scoring implementation."
 * (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md) — the exact 12 Quality Dimensions, labels
 * only, attached to `KnowledgeQualityFinding`/`KnowledgeQualityScoreMetadata`/
 * `KnowledgeQualityRule`/`KnowledgeQualityProfile`. This package never computes a score
 * for any of them — the enum exists purely to classify what a caller-supplied
 * `IKnowledgeQualityProvider`/`IKnowledgeQualityScoringProvider` reported.
 */
export enum KnowledgeQualityDimension {
  ACCURACY = "accuracy",
  COMPLETENESS = "completeness",
  CONSISTENCY = "consistency",
  CLARITY = "clarity",
  READABILITY = "readability",
  STRUCTURE = "structure",
  FRESHNESS = "freshness",
  COMPLIANCE = "compliance",
  RELEVANCE = "relevance",
  TRACEABILITY = "traceability",
  CONFIDENCE = "confidence",
  RISK = "risk",
}
