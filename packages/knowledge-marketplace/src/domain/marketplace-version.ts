import { z } from "zod";

/**
 * "MarketplaceVersion" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Domain Model")
 * — one published version metadata record for a `MarketplacePackage`. Metadata only —
 * no artifact reference, no build, no deployment.
 */
export const marketplaceVersionSchema = z.object({
  id: z.string().min(1),
  packageId: z.string().min(1),
  version: z.string().min(1),
  releaseNotes: z.string().optional(),
  releasedAt: z.string().datetime(),
});

export type MarketplaceVersion = z.infer<typeof marketplaceVersionSchema>;
