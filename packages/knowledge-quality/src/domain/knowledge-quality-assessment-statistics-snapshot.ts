/**
 * "KnowledgeQualityStatistics" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Domain
 * Model") — per-`KnowledgeQualityAssessmentMode` bookkeeping snapshot maintained by
 * `KnowledgeQualityStatistics`. Keyed by Assessment Mode (rather than Quality
 * Dimension, since a single Assessment can span many Dimensions but always has exactly
 * one Mode) — a documented judgment call, see docs/005.7L-KNOWLEDGE-QUALITY-ENGINE-
 * REPORT.md — "Statistics".
 */
export interface KnowledgeQualityAssessmentStatisticsSnapshot {
  readonly requestedCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly lastActivityAt?: string;
}

export const EMPTY_KNOWLEDGE_QUALITY_ASSESSMENT_STATISTICS: KnowledgeQualityAssessmentStatisticsSnapshot =
  {
    requestedCount: 0,
    completedCount: 0,
    failedCount: 0,
  };
