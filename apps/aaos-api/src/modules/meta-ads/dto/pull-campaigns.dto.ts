import { z } from "zod";

const AD_ACCOUNT_ID_PATTERN = /^act_\d+$/;

/** `GET /api/v1/campaigns` query — per the spec's Meta Ads endpoints section. */
export const PullCampaignsQuerySchema = z.object({
  adAccountId: z
    .string()
    .regex(AD_ACCOUNT_ID_PATTERN, 'adAccountId must match "act_<digits>"')
    .optional(),
  datePreset: z.enum(["last_7d", "last_14d", "last_30d"]).optional().default("last_30d"),
});

export type PullCampaignsQueryDto = z.infer<typeof PullCampaignsQuerySchema>;
