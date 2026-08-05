import { z } from "zod";

/** Per-`KnowledgeSearchMode` bookkeeping `KnowledgeRetrievalStatistics` maintains. */
export const knowledgeRetrievalStatisticsSnapshotSchema = z.object({
  queryCount: z.number().int().nonnegative(),
  resultCount: z.number().int().nonnegative(),
  lastQueriedAt: z.string().datetime().optional(),
});

export type KnowledgeRetrievalStatisticsSnapshot = z.infer<
  typeof knowledgeRetrievalStatisticsSnapshotSchema
>;

export const EMPTY_KNOWLEDGE_RETRIEVAL_STATISTICS: KnowledgeRetrievalStatisticsSnapshot = {
  queryCount: 0,
  resultCount: 0,
};
