import { z } from "zod";

/** "MarketplaceAudit" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Domain Model") — audit trail entry for a Marketplace Operation. */
export const marketplaceAuditEntrySchema = z.object({
  id: z.string().min(1),
  operation: z.string().min(1),
  listingId: z.string().min(1),
  tenantId: z.string().min(1),
  fromState: z.string().optional(),
  toState: z.string().optional(),
  reason: z.string().optional(),
  occurredAt: z.string().datetime(),
});

export type MarketplaceAuditEntry = z.infer<typeof marketplaceAuditEntrySchema>;
