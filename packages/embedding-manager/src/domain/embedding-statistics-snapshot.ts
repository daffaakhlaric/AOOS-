import { z } from "zod";

/**
 * "EmbeddingStatistics" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Domain Model") — a
 * point-in-time snapshot of per-`EmbeddingProviderType` bookkeeping, returned by
 * `statistics/embedding-statistics.ts` (the Public API `EmbeddingStatistics` class,
 * keyed by Provider Type — mirroring the per-Category keying convention established by
 * `@aos/knowledge-validator`'s `KnowledgeValidatorStatistics`). Named
 * `...SnapshotSchema` to avoid colliding with the class of the same domain-list name.
 */
export const embeddingStatisticsSnapshotSchema = z.object({
  requestedCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  cancelledCount: z.number().int().nonnegative(),
  lastActivityAt: z.string().datetime().optional(),
});

export type EmbeddingStatisticsSnapshot = z.infer<typeof embeddingStatisticsSnapshotSchema>;

export const EMPTY_EMBEDDING_STATISTICS: EmbeddingStatisticsSnapshot = {
  requestedCount: 0,
  completedCount: 0,
  failedCount: 0,
  cancelledCount: 0,
};
