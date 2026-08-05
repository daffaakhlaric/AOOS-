import { z } from "zod";

/** "Execution Time, Load Time" (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) — per-Instance runtime statistics, distinct from the aggregate `KnowledgeRuntimeMetrics`. */
export const knowledgeRuntimeStatisticsSchema = z.object({
  transitionCount: z.number().int().nonnegative(),
  suspendCount: z.number().int().nonnegative(),
  resumeCount: z.number().int().nonnegative(),
  loadTimeMs: z.number().nonnegative().optional(),
  executionTimeMs: z.number().nonnegative().optional(),
});

export type KnowledgeRuntimeStatistics = z.infer<typeof knowledgeRuntimeStatisticsSchema>;

export const EMPTY_KNOWLEDGE_RUNTIME_STATISTICS: KnowledgeRuntimeStatistics = {
  transitionCount: 0,
  suspendCount: 0,
  resumeCount: 0,
};
