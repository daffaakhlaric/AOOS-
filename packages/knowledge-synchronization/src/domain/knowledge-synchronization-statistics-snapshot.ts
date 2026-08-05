import { z } from "zod";

/** Per-`KnowledgeSynchronizationMode` bookkeeping `KnowledgeSynchronizationStatistics` maintains. */
export const knowledgeSynchronizationStatisticsSnapshotSchema = z.object({
  syncCount: z.number().int().nonnegative(),
  changeCount: z.number().int().nonnegative(),
  lastSyncedAt: z.string().datetime().optional(),
});

export type KnowledgeSynchronizationStatisticsSnapshot = z.infer<
  typeof knowledgeSynchronizationStatisticsSnapshotSchema
>;

export const EMPTY_KNOWLEDGE_SYNCHRONIZATION_STATISTICS: KnowledgeSynchronizationStatisticsSnapshot =
  {
    syncCount: 0,
    changeCount: 0,
  };
