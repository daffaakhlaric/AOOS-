import { BranchId } from "@aos/branch-manager";
import { z } from "zod";

/**
 * `GET /api/v1/closings` query — "closings (per sales)" per the spec. `salesHumanId` is the
 * primary filter `apps/aaos-crm` uses ("my closings"); `fromDate`/`toDate` default to the
 * current calendar month when omitted (the service applies the default, not this schema, so it
 * can use a real clock).
 */
export const GetClosingsQuerySchema = z.object({
  salesHumanId: z.string().min(1).optional(),
  branchId: z.nativeEnum(BranchId).optional(),
  campaignId: z.string().min(1).optional(),
  adId: z.string().min(1).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

export type GetClosingsQueryDto = z.infer<typeof GetClosingsQuerySchema>;
