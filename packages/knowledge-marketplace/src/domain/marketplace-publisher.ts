import { z } from "zod";

import { MarketplaceType } from "./marketplace-type.js";

/**
 * "MarketplacePublisher" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Domain
 * Model") — publisher metadata only. "No authentication" — `verified` is a metadata
 * flag set by an Extension Point (e.g. `IKnowledgeMarketplaceApprovalProvider`), never
 * an authentication outcome.
 */
export const marketplacePublisherSchema = z.object({
  id: z.string().min(1),
  publisherId: z.string().min(1),
  name: z.string().min(1),
  marketplaceType: z.nativeEnum(MarketplaceType),
  verified: z.boolean(),
  contactEmail: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MarketplacePublisher = z.infer<typeof marketplacePublisherSchema>;
