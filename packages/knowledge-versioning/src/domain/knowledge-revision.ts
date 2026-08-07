import { z } from "zod";

/**
 * "KnowledgeRevision" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Domain Model") —
 * one numbered revision entry in a version's revision history. "This package owns ONLY:
 * ... Revision history" — a revision records THAT a version was revised (number, summary,
 * author, timestamp), never WHAT changed (no diff engine, no content).
 */
export const knowledgeRevisionSchema = z.object({
  id: z.string().min(1),
  versionId: z.string().min(1),
  revisionNumber: z.number().int().positive(),
  summary: z.string().optional(),
  author: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeRevision = z.infer<typeof knowledgeRevisionSchema>;
