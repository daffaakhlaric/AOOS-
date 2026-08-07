import { z } from "zod";

import { marketplacePackageStatusSchema } from "./marketplace-state-schema.js";

/**
 * "MarketplaceListing" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Domain Model") —
 * the marketplace-facing presentation of a `MarketplacePackage`: `id` is the Listing's
 * stable identity, `token` is the externally addressable `KnowledgeMarketplaceToken`
 * every imperative operation uses to look it up — "Implement token-based registries.
 * Never scan collections." `packageId` references the underlying `MarketplacePackage`.
 */
export const marketplaceListingSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  listingId: z.string().min(1),
  packageId: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  state: marketplacePackageStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().optional(),
  removedAt: z.string().datetime().optional(),
});

export type MarketplaceListing = z.infer<typeof marketplaceListingSchema>;
