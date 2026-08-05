import { z } from "zod";

/** "CHUNK REFERENCES: Do NOT chunk documents. Store ONLY chunk references. Chunking belongs to future Retrieval." (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md) — a pointer to a chunk this package never creates. */
export const knowledgeChunkReferenceSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  externalRef: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type KnowledgeChunkReference = z.infer<typeof knowledgeChunkReferenceSchema>;
