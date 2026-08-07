import { z } from "zod";

/**
 * "MarketplaceCompatibility" / "COMPATIBILITY METADATA: Support metadata for: AOS
 * Version, Required Packages, Optional Packages, Required Knowledge Version, Runtime
 * Compatibility, Platform Compatibility. No installation logic."
 * (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md) — the exact 6 compatibility fields.
 */
export const marketplaceCompatibilitySchema = z.object({
  id: z.string().min(1),
  listingId: z.string().min(1),
  aosVersion: z.string().min(1),
  requiredPackages: z.array(z.string()),
  optionalPackages: z.array(z.string()),
  requiredKnowledgeVersion: z.string().min(1),
  runtimeCompatibility: z.array(z.string()),
  platformCompatibility: z.array(z.string()),
  recordedAt: z.string().datetime(),
});

export type MarketplaceCompatibility = z.infer<typeof marketplaceCompatibilitySchema>;
