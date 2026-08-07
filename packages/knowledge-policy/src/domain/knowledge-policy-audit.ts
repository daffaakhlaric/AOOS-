import { z } from "zod";

/**
 * "KnowledgePolicyAudit" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Domain Model") —
 * audit trail entry for a policy operation.
 */
export const knowledgePolicyAuditEntrySchema = z.object({
  id: z.string().min(1),
  operation: z.string().min(1),
  policyId: z.string().min(1),
  tenantId: z.string().min(1),
  fromState: z.string().optional(),
  toState: z.string().optional(),
  reason: z.string().optional(),
  occurredAt: z.string().datetime(),
});

export type KnowledgePolicyAuditEntry = z.infer<typeof knowledgePolicyAuditEntrySchema>;
