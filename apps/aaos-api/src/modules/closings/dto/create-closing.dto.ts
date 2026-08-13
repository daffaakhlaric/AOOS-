import { ClosingType } from "@aos/lead-store";
import { z } from "zod";

/** `POST /api/v1/closings` body — a sales human recording a test drive, SPK, or cancellation. Mirrors `@aos/lead-store`'s `RecordClosingInput` (minus `tenantId`/`correlationId`, which the service supplies). */
export const CreateClosingBodySchema = z.object({
  leadId: z.string().min(1, "leadId must not be empty"),
  salesHumanId: z.string().min(1, "salesHumanId must not be empty"),
  closingType: z.nativeEnum(ClosingType),
  unitId: z.string().min(1).optional(),
  unitModel: z.string().min(1).optional(),
  unitPrice: z.number().nonnegative().optional(),
  campaignId: z.string().min(1).optional(),
  adId: z.string().min(1).optional(),
  commissionIdr: z.number().nonnegative().optional(),
  commissionPct: z.number().min(0).max(100).optional(),
  notes: z.string().min(1).optional(),
});

export type CreateClosingBodyDto = z.infer<typeof CreateClosingBodySchema>;
