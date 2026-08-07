import { z } from "zod";

/**
 * "KnowledgeMerge" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Domain Model") — the
 * metadata record of one merge: source version, target version, and the NAME of the
 * strategy a caller-supplied `IKnowledgeMergeStrategy` would apply. "Merge contracts"
 * only — "No merge algorithm." — this package records that a merge happened; it never
 * computes one.
 */
export const knowledgeMergeSchema = z.object({
  id: z.string().min(1),
  sourceVersionId: z.string().min(1),
  targetVersionId: z.string().min(1),
  strategy: z.string().optional(),
  initiatedBy: z.string().optional(),
  occurredAt: z.string().datetime(),
});

export type KnowledgeMerge = z.infer<typeof knowledgeMergeSchema>;
