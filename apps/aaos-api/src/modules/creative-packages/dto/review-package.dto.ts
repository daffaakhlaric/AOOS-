import { z } from "zod";

/** `POST /api/v1/creative-packages/:id/approve` body — the chosen copy variant is optional (defaults to the package's first variant, "A", when omitted). */
export const ApprovePackageBodySchema = z.object({
  selectedCopyVariantId: z.string().min(1).optional(),
});
export type ApprovePackageBodyDto = z.infer<typeof ApprovePackageBodySchema>;

/** `POST /api/v1/creative-packages/:id/reject` body — an optional reason, logged but not currently surfaced elsewhere. */
export const RejectPackageBodySchema = z.object({
  reason: z.string().min(1).optional(),
});
export type RejectPackageBodyDto = z.infer<typeof RejectPackageBodySchema>;
