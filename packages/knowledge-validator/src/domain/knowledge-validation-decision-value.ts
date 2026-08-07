/**
 * "VALIDATION DECISIONS: Support metadata — Approved, Conditionally Approved, Requires
 * Review, Requires Revision, Rejected, Expired. Metadata ONLY. No decision algorithm."
 * (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md) — the exact 6 Validation Decision values.
 * This package NEVER computes which value applies — it only records what a
 * caller-supplied `IKnowledgeValidationDecisionProvider`/reviewer reported, as a
 * `KnowledgeValidationDecision`.
 */
export enum KnowledgeValidationDecisionValue {
  APPROVED = "approved",
  CONDITIONALLY_APPROVED = "conditionally_approved",
  REQUIRES_REVIEW = "requires_review",
  REQUIRES_REVISION = "requires_revision",
  REJECTED = "rejected",
  EXPIRED = "expired",
}

/** Decision values a caller may legally record when driving a Validation to Approved. */
export const APPROVAL_DECISION_VALUES: ReadonlySet<KnowledgeValidationDecisionValue> = new Set([
  KnowledgeValidationDecisionValue.APPROVED,
  KnowledgeValidationDecisionValue.CONDITIONALLY_APPROVED,
]);

/** Decision values a caller may legally record when driving a Validation to Rejected. */
export const REJECTION_DECISION_VALUES: ReadonlySet<KnowledgeValidationDecisionValue> = new Set([
  KnowledgeValidationDecisionValue.REJECTED,
  KnowledgeValidationDecisionValue.REQUIRES_REVISION,
  KnowledgeValidationDecisionValue.REQUIRES_REVIEW,
  KnowledgeValidationDecisionValue.EXPIRED,
]);
