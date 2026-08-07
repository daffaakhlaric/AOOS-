import { z } from "zod";

/** Per-`KnowledgePolicyType` statistics snapshot. */
export const knowledgePolicyStatisticsSnapshotSchema = z.object({
  createdCount: z.number().int().min(0),
  activatedCount: z.number().int().min(0),
  lastActivityAt: z.string().datetime().optional(),
});

export type KnowledgePolicyStatisticsSnapshot = z.infer<
  typeof knowledgePolicyStatisticsSnapshotSchema
>;

export const EMPTY_KNOWLEDGE_POLICY_STATISTICS: KnowledgePolicyStatisticsSnapshot = {
  createdCount: 0,
  activatedCount: 0,
  lastActivityAt: undefined,
};
