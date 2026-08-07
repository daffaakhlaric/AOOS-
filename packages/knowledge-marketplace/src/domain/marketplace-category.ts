import { z } from "zod";

import { MarketplaceCategoryName } from "./marketplace-category-name.js";

/**
 * "MarketplaceCategory" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Domain Model")
 * — a registered Category record. Built-in categories (every `MarketplaceCategoryName`
 * other than `Custom`) always resolve without a registered record; `Custom`-named
 * categories MUST be registered here first ("Category Registry ... allowing additional
 * Custom-typed categories to be registered at runtime").
 */
export const marketplaceCategorySchema = z.object({
  id: z.string().min(1),
  name: z.nativeEnum(MarketplaceCategoryName),
  label: z.string().min(1),
  description: z.string().optional(),
  custom: z.boolean(),
  createdAt: z.string().datetime(),
});

export type MarketplaceCategory = z.infer<typeof marketplaceCategorySchema>;
