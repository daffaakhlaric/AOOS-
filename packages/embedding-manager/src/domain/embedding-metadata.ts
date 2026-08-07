import { z } from "zod";

/**
 * "EmbeddingMetadata" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Domain Model") —
 * descriptive metadata about an Embedding (title, tags, ownership) attached during the
 * Pipeline's Metadata stage (stage 6).
 */
export const embeddingMetadataSchema = z.object({
  id: z.string().min(1),
  embeddingId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdBy: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EmbeddingMetadata = z.infer<typeof embeddingMetadataSchema>;
