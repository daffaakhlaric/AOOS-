import { z } from "zod";

/** Per-`KnowledgeVersionType` bookkeeping `KnowledgeVersionStatistics` maintains. */
export const knowledgeVersionStatisticsSnapshotSchema = z.object({
  createdCount: z.number().int().nonnegative(),
  publishedCount: z.number().int().nonnegative(),
  lastActivityAt: z.string().datetime().optional(),
});

export type KnowledgeVersionStatisticsSnapshot = z.infer<
  typeof knowledgeVersionStatisticsSnapshotSchema
>;

export const EMPTY_KNOWLEDGE_VERSION_STATISTICS: KnowledgeVersionStatisticsSnapshot = {
  createdCount: 0,
  publishedCount: 0,
};
