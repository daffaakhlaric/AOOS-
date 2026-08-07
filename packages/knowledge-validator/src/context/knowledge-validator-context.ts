import { z } from "zod";

/**
 * "KnowledgeValidatorContext" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Public
 * API") — the caller-scoped execution context every Validation Operation runs under.
 */
export const knowledgeValidatorContextSchema = z.object({
  token: z.string().min(1),
  validationId: z.string().min(1),
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

export type KnowledgeValidatorContext = z.infer<typeof knowledgeValidatorContextSchema>;
