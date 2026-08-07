import { z } from "zod";

/** "MarketplaceTag" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Domain Model") — a free-form Listing tag. */
export const marketplaceTagSchema = z.object({
  id: z.string().min(1),
  listingId: z.string().min(1),
  name: z.string().min(1),
});

export type MarketplaceTag = z.infer<typeof marketplaceTagSchema>;
