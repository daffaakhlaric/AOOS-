/**
 * "ASSESSMENT MODES: Support Full Assessment, Quick Assessment, Compliance Review,
 * Editorial Review, Policy Review, Structural Review, Metadata Review, Custom."
 * (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md) — the exact 8 Assessment Modes, attached to
 * a `KnowledgeQualityAssessmentRequest` as a metadata label only.
 */
export enum KnowledgeQualityAssessmentMode {
  FULL_ASSESSMENT = "full_assessment",
  QUICK_ASSESSMENT = "quick_assessment",
  COMPLIANCE_REVIEW = "compliance_review",
  EDITORIAL_REVIEW = "editorial_review",
  POLICY_REVIEW = "policy_review",
  STRUCTURAL_REVIEW = "structural_review",
  METADATA_REVIEW = "metadata_review",
  CUSTOM = "custom",
}
