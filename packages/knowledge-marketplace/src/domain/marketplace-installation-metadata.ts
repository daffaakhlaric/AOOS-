import { z } from "zod";

/**
 * "MarketplaceInstallationMetadata" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md —
 * "Domain Model") — installation instructions/requirements as DATA only. Never
 * downloads, never executes, never installs anything.
 */
export const marketplaceInstallationMetadataSchema = z.object({
  id: z.string().min(1),
  listingId: z.string().min(1),
  instructions: z.string().min(1),
  requirements: z.array(z.string()),
  estimatedSetupMinutes: z.number().int().min(0).optional(),
  recordedAt: z.string().datetime(),
});

export type MarketplaceInstallationMetadata = z.infer<typeof marketplaceInstallationMetadataSchema>;
