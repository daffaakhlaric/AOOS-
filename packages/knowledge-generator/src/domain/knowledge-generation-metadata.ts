import { z } from "zod";

/**
 * "KnowledgeGenerationMetadata" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Domain
 * Model") — the descriptive metadata record for one Generation.
 */
export const knowledgeGenerationMetadataSchema = z.object({
  generationId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  tags: z.array(z.string()),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KnowledgeGenerationMetadata = z.infer<typeof knowledgeGenerationMetadataSchema>;
