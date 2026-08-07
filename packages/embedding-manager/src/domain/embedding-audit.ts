import { z } from "zod";

/**
 * "EmbeddingAudit" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Domain Model") — one
 * immutable audit-trail entry, appended by the Pipeline's Audit stage (stage 9) on every
 * lifecycle-driving Embedding Operation. Registered in the AUDIT Registry bucket keyed by
 * `auditId`.
 */
export const embeddingAuditSchema = z.object({
  id: z.string().min(1),
  auditId: z.string().min(1),
  embeddingId: z.string().min(1),
  tenantId: z.string().min(1),
  action: z.string().min(1),
  actor: z.string().optional(),
  details: z.string().optional(),
  occurredAt: z.string().datetime(),
});

export type EmbeddingAudit = z.infer<typeof embeddingAuditSchema>;
