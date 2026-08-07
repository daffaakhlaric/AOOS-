import { z } from "zod";

/**
 * "KnowledgeRollback" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Domain Model") —
 * the metadata record of one rollback: which version was rolled back, which earlier
 * version it was rolled back to, and why. "Rollback contracts" only — actually restoring
 * stored content is delegated to the `IKnowledgeRollbackProvider` Extension Point.
 */
export const knowledgeRollbackSchema = z.object({
  id: z.string().min(1),
  versionId: z.string().min(1),
  targetVersionId: z.string().min(1),
  reason: z.string().optional(),
  initiatedBy: z.string().optional(),
  occurredAt: z.string().datetime(),
});

export type KnowledgeRollback = z.infer<typeof knowledgeRollbackSchema>;
