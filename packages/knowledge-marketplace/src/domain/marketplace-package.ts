import { z } from "zod";

import { MarketplaceCategoryName } from "./marketplace-category-name.js";
import { MarketplaceType } from "./marketplace-type.js";

/**
 * "MarketplacePackage" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Domain Model") —
 * the underlying software/knowledge unit a `MarketplaceListing` presents on the
 * Marketplace. Registered once, referenced by id from every Listing that publishes it.
 * Metadata only — never the Knowledge Asset's content, never an installable artifact.
 */
export const marketplacePackageSchema = z.object({
  id: z.string().min(1),
  packageId: z.string().min(1),
  name: z.string().min(1),
  publisherId: z.string().min(1),
  marketplaceType: z.nativeEnum(MarketplaceType),
  category: z.nativeEnum(MarketplaceCategoryName),
  currentVersion: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MarketplacePackage = z.infer<typeof marketplacePackageSchema>;
