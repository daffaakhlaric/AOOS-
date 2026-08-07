import { z } from "zod";

/**
 * "KnowledgeGenerationAudit" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Domain
 * Model") — one immutable audit entry appended by the Pipeline's Audit stage (Stage 9)
 * and registered in the AUDIT Registry bucket keyed by `auditId`.
 */
export const knowledgeGenerationAuditSchema = z.object({
  id: z.string().min(1),
  auditId: z.string().min(1),
  generationId: z.string().min(1),
  tenantId: z.string().min(1),
  operation: z.string().min(1),
  actor: z.string().optional(),
  fromState: z.string().optional(),
  toState: z.string().optional(),
  reason: z.string().optional(),
  occurredAt: z.string().datetime(),
});

export type KnowledgeGenerationAudit = z.infer<typeof knowledgeGenerationAuditSchema>;
