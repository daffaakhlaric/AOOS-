import { z } from "zod";

import { MarketplaceDependencyKind } from "./marketplace-dependency-kind.js";

/**
 * "MarketplaceDependency" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Domain
 * Model" / "Dependency Metadata") — one declared dependency edge from a Listing to
 * another Package, tagged with its `MarketplaceDependencyKind`. Metadata only — no
 * version-solving algorithm, no installation.
 */
export const marketplaceDependencySchema = z.object({
  id: z.string().min(1),
  listingId: z.string().min(1),
  dependencyPackageId: z.string().min(1),
  kind: z.nativeEnum(MarketplaceDependencyKind),
  versionRange: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type MarketplaceDependency = z.infer<typeof marketplaceDependencySchema>;
