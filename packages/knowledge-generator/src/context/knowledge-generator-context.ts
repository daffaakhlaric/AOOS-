import { z } from "zod";

/**
 * "KnowledgeGeneratorContext" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Public
 * API") — the caller-scoped execution context every Generation Operation runs under.
 */
export const knowledgeGeneratorContextSchema = z.object({
  token: z.string().min(1),
  generationId: z.string().min(1),
  tenantId: z.string().min(1),
  organizationId: z.string().optional(),
  workspaceId: z.string().optional(),
  departmentId: z.string().optional(),
  environment: z.string().optional(),
  namespace: z.string().optional(),
  metadata: z.record(z.unknown()),
  traceId: z.string().optional(),
  correlationId: z.string().min(1),
});

export type KnowledgeGeneratorContext = z.infer<typeof knowledgeGeneratorContextSchema>;
