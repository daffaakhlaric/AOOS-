/**
 * "KnowledgeValidationStatistics" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Domain
 * Model") — per-`KnowledgeValidationCategory` bookkeeping snapshot maintained by
 * `KnowledgeValidatorStatistics`. Keyed by the Request's primary Validation Category
 * (rather than by Rule Category, since a single Validation can span many Rule
 * Categories but always declares exactly one primary Category on its Request) — a
 * documented judgment call, see docs/005.7M-KNOWLEDGE-VALIDATOR-AI-REPORT.md —
 * "Statistics".
 */
export interface KnowledgeValidationStatisticsSnapshot {
  readonly requestedCount: number;
  readonly approvedCount: number;
  readonly rejectedCount: number;
  readonly lastActivityAt?: string;
}

export const EMPTY_KNOWLEDGE_VALIDATION_STATISTICS: KnowledgeValidationStatisticsSnapshot = {
  requestedCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
};
