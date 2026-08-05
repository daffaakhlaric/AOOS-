import { z } from "zod";

/** Per-`KnowledgeIndexType` bookkeeping `KnowledgeIndexStatistics` maintains — "Registry: Maintain ... Statistics." */
export const knowledgeIndexStatisticsSnapshotSchema = z.object({
  entryCount: z.number().int().nonnegative(),
  lastBuiltAt: z.string().datetime().optional(),
  lastOptimizedAt: z.string().datetime().optional(),
  lastRebuiltAt: z.string().datetime().optional(),
});

export type KnowledgeIndexStatisticsSnapshot = z.infer<
  typeof knowledgeIndexStatisticsSnapshotSchema
>;

export const EMPTY_KNOWLEDGE_INDEX_STATISTICS: KnowledgeIndexStatisticsSnapshot = {
  entryCount: 0,
};
