import { z } from "zod";

/**
 * "KnowledgeValidationMetadata" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Domain
 * Model") — the descriptive metadata record for one Validation.
 */
export const knowledgeValidationMetadataSchema = z.object({
  validationId: z.string().min(1),
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

export type KnowledgeValidationMetadata = z.infer<typeof knowledgeValidationMetadataSchema>;
