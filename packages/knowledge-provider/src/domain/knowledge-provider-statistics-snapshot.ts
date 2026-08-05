import { z } from "zod";

/** Per-`KnowledgeProviderCategory` bookkeeping `KnowledgeProviderStatistics` maintains. */
export const knowledgeProviderStatisticsSnapshotSchema = z.object({
  registrationCount: z.number().int().nonnegative(),
  usageCount: z.number().int().nonnegative(),
  lastUsedAt: z.string().datetime().optional(),
});

export type KnowledgeProviderStatisticsSnapshot = z.infer<
  typeof knowledgeProviderStatisticsSnapshotSchema
>;

export const EMPTY_KNOWLEDGE_PROVIDER_STATISTICS: KnowledgeProviderStatisticsSnapshot = {
  registrationCount: 0,
  usageCount: 0,
};
