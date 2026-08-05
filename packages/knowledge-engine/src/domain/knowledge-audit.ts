import { z } from "zod";

/** "KnowledgeAudit" — one immutable audit-trail entry, appended by every mutating operation across this package (Repository/Lifecycle/Policy/Permission/Relationship/Version). */
export const knowledgeAuditSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  action: z.string().min(1),
  actorId: z.string().optional(),
  occurredAt: z.string().datetime(),
  details: z.record(z.unknown()).optional(),
});

export type KnowledgeAudit = z.infer<typeof knowledgeAuditSchema>;
