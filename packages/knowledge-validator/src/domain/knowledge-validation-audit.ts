import { z } from "zod";

/**
 * "KnowledgeValidationAudit" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Domain
 * Model") — one immutable audit entry appended by the Pipeline's Audit stage (Stage 9)
 * and registered in the AUDIT Registry bucket keyed by `auditId`.
 */
export const knowledgeValidationAuditSchema = z.object({
  id: z.string().min(1),
  auditId: z.string().min(1),
  validationId: z.string().min(1),
  tenantId: z.string().min(1),
  operation: z.string().min(1),
  actor: z.string().optional(),
  fromState: z.string().optional(),
  toState: z.string().optional(),
  reason: z.string().optional(),
  occurredAt: z.string().datetime(),
});

export type KnowledgeValidationAudit = z.infer<typeof knowledgeValidationAuditSchema>;
