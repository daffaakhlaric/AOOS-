import { z } from "zod";

/** Tenant is supplied by authentication, never by this body. Links and QA are server-owned. */
export const SaveCampaignDraftSchema = z
  .object({
    id: z.string().uuid(),
    listingId: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    goal: z.enum([
      "WhatsApp Leads",
      "Qualified Leads",
      "Meta Lead Form",
      "Website Conversion",
      "Retargeting",
      "Traffic",
      "Awareness",
      "Engagement",
    ]),
    dailyBudget: z.number().finite().min(0).max(1e10),
    start: z.string().date(),
    end: z.string().date(),
    copyIndex: z.number().int().min(0).max(4),
    metaDestination: z
      .object({
        pageId: z.string().regex(/^\d+$/),
        adAccountId: z.string().regex(/^(act_)?\d+$/),
        number: z.string().max(30),
      })
      .nullable()
      .optional(),
    expectedRevision: z.number().int().min(0).default(0),
  })
  .refine((draft) => Date.parse(draft.end) >= Date.parse(draft.start), {
    path: ["end"],
    message: "Tanggal akhir sebelum tanggal mulai",
  });
export type SaveCampaignDraft = z.infer<typeof SaveCampaignDraftSchema>;
