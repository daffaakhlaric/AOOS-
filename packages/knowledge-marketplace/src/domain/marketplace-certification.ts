import { z } from "zod";

import { MarketplaceCertificationLevel } from "./marketplace-certification-level.js";

/**
 * "MarketplaceCertification" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Domain
 * Model") — certification metadata recorded by the "Certify" Marketplace Operation.
 */
export const marketplaceCertificationSchema = z.object({
  id: z.string().min(1),
  listingId: z.string().min(1),
  level: z.nativeEnum(MarketplaceCertificationLevel),
  certifiedBy: z.string().min(1),
  notes: z.string().optional(),
  certifiedAt: z.string().datetime(),
});

export type MarketplaceCertification = z.infer<typeof marketplaceCertificationSchema>;
