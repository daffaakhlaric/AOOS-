import { z } from "zod";

/**
 * "KnowledgeComparison" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Domain Model") —
 * "Comparison metadata": which two versions were compared, when, and an optional
 * caller-supplied opaque result payload (e.g. produced by an external
 * `IKnowledgeComparisonEngine`/`IKnowledgeDiffProvider`). "No diff engine." — this
 * package never computes a difference itself.
 */
export const knowledgeComparisonSchema = z.object({
  id: z.string().min(1),
  leftVersionId: z.string().min(1),
  rightVersionId: z.string().min(1),
  result: z.record(z.unknown()).optional(),
  comparedBy: z.string().optional(),
  comparedAt: z.string().datetime(),
});

export type KnowledgeComparison = z.infer<typeof knowledgeComparisonSchema>;
