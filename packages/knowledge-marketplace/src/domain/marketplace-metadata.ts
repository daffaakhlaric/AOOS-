import { z } from "zod";

import { MarketplaceCategoryName } from "./marketplace-category-name.js";
import { MarketplaceType } from "./marketplace-type.js";

/**
 * "MarketplaceMetadata" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Domain
 * Model") — the descriptive metadata record for one Marketplace Listing. This package
 * owns ONLY marketplace metadata — no asset content, no file references, no secrets.
 */
export const marketplaceMetadataSchema = z.object({
  listingId: z.string().min(1),
  packageId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().optional(),
  description: z.string().optional(),
  marketplaceType: z.nativeEnum(MarketplaceType),
  category: z.nativeEnum(MarketplaceCategoryName),
  publisherId: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  keywords: z.array(z.string()),
  tags: z.array(z.string()),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MarketplaceMetadata = z.infer<typeof marketplaceMetadataSchema>;
