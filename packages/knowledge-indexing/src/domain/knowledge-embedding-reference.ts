import { z } from "zod";

/** "EMBEDDING REFERENCES: Never generate embeddings. Only store references." (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md) — the exact field list from the prompt (embeddingId, provider, version, model, status). */
export const knowledgeEmbeddingReferenceSchema = z.object({
  embeddingId: z.string().min(1),
  provider: z.string().min(1),
  version: z.string().min(1),
  model: z.string().min(1),
  status: z.enum(["pending", "ready", "stale", "failed"]),
});

export type KnowledgeEmbeddingReference = z.infer<typeof knowledgeEmbeddingReferenceSchema>;
