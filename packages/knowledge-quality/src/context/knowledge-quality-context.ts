import { z } from "zod";

/**
 * "KnowledgeQualityContext" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Public
 * API") — the caller-scoped execution context every Assessment Operation runs under.
 */
export const knowledgeQualityContextSchema = z.object({
  token: z.string().min(1),
  assessmentId: z.string().min(1),
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

export type KnowledgeQualityContext = z.infer<typeof knowledgeQualityContextSchema>;
