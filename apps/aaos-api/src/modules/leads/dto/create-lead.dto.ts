import { BranchId } from "@aos/branch-manager";
import { LeadSource } from "@aos/lead-store";
import { z } from "zod";

/** `POST /api/v1/leads` body — per `docs/PROMPT-AAOS-W2E-LEAD-STORE.md`'s `CreateLead` use case signature. */
export const CreateLeadBodySchema = z.object({
  leadSource: z.nativeEnum(LeadSource),
  leadPhone: z.string().min(1, "leadPhone must not be empty"),
  branchId: z.nativeEnum(BranchId),
  wabaPhoneNumberId: z.string().min(1, "wabaPhoneNumberId must not be empty"),
  campaignId: z.string().min(1).optional(),
  adId: z.string().min(1).optional(),
  adAccountId: z.string().min(1).optional(),
  leadName: z.string().min(1).optional(),
});

export type CreateLeadBodyDto = z.infer<typeof CreateLeadBodySchema>;
