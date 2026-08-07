import { z } from "zod";

import { knowledgeVersionStateSchema } from "./knowledge-version-state-schema.js";

/**
 * "This package owns ONLY: ... Version audit metadata" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md)
 * — one audit record appended to a `KnowledgeVersionExecution` by the Pipeline's Audit
 * stage (stage 7) on every successful run. In-memory metadata only — forwarding audit
 * records to an external audit store is delegated to the `IKnowledgeAuditProvider`
 * Extension Point.
 */
export const knowledgeVersionAuditEntrySchema = z.object({
  id: z.string().min(1),
  operation: z.string().min(1),
  versionId: z.string().min(1),
  tenantId: z.string().min(1),
  fromState: knowledgeVersionStateSchema.optional(),
  toState: knowledgeVersionStateSchema.optional(),
  reason: z.string().optional(),
  occurredAt: z.string().datetime(),
});

export type KnowledgeVersionAuditEntry = z.infer<typeof knowledgeVersionAuditEntrySchema>;
