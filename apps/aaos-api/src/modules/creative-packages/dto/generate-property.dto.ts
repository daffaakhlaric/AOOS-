import { z } from "zod";

import { MAX_VARIANT_COUNT, MIN_VARIANT_COUNT } from "../../llm/dto/ad-copy-variants.dto.js";

/**
 * `POST /api/v1/creative-packages/property/:id/generate`'s request body. Additive/optional —
 * bulk-publish widening (user-requested scope: "Publish otomatis creative dalam jumlah besar
 * (8-25) langsung ke Meta", previously hard-capped at 3 ads per ad set). Omitting
 * `requestedVariantCount` entirely keeps the pre-existing, real 3-variant default
 * (`CreativePackagesService.generateProperty`'s own doc) — no behavior change for a caller that
 * never sends a body at all, which is every real caller before this widening.
 */
export const GeneratePropertyBodySchema = z
  .object({
    requestedVariantCount: z
      .number()
      .int()
      .min(MIN_VARIANT_COUNT)
      .max(MAX_VARIANT_COUNT)
      .optional(),
  })
  .optional()
  .default({});

export type GeneratePropertyBodyDto = z.infer<typeof GeneratePropertyBodySchema>;
