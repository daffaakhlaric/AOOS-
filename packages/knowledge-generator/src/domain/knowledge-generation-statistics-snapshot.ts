/**
 * "KnowledgeGenerationStatistics" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Domain
 * Model") — per-`KnowledgeGenerationAssetType` bookkeeping snapshot maintained by
 * `KnowledgeGeneratorStatistics`.
 */
export interface KnowledgeGenerationStatisticsSnapshot {
  readonly requestedCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly lastActivityAt?: string;
}

export const EMPTY_KNOWLEDGE_GENERATION_STATISTICS: KnowledgeGenerationStatisticsSnapshot = {
  requestedCount: 0,
  completedCount: 0,
  failedCount: 0,
};
