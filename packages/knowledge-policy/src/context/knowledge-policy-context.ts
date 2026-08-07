import { z } from "zod";

/**
 * "KnowledgePolicyContext" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Public API") —
 * the caller-scoped execution context every Policy Operation runs under.
 */
export const knowledgePolicyContextSchema = z.object({
  token: z.string().min(1),
  policyId: z.string().min(1),
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

export type KnowledgePolicyContext = z.infer<typeof knowledgePolicyContextSchema>;
