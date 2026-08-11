import { z } from "zod";

/** `POST /api/v1/verdicts` body — per the spec's Meta Ads endpoints section. */
export const ExecuteVerdictBodySchema = z.object({
  verdict: z.enum(["PAUSE", "SCALE", "FIX", "REFRESH", "KEEP", "REVIEW"]),
  targetId: z.string().min(1, "targetId must not be empty"),
  targetType: z.enum(["ad", "adset", "campaign"]),
});

export type ExecuteVerdictBodyDto = z.infer<typeof ExecuteVerdictBodySchema>;
