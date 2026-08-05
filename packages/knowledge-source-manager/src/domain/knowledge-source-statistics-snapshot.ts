import { z } from "zod";

/** Per-`KnowledgeSourceCategory` bookkeeping `KnowledgeSourceStatistics` maintains. */
export const knowledgeSourceStatisticsSnapshotSchema = z.object({
  registrationCount: z.number().int().nonnegative(),
  usageCount: z.number().int().nonnegative(),
  lastUsedAt: z.string().datetime().optional(),
});

export type KnowledgeSourceStatisticsSnapshot = z.infer<
  typeof knowledgeSourceStatisticsSnapshotSchema
>;

export const EMPTY_KNOWLEDGE_SOURCE_STATISTICS: KnowledgeSourceStatisticsSnapshot = {
  registrationCount: 0,
  usageCount: 0,
};
