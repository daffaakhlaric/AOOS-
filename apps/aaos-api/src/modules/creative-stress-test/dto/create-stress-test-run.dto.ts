import { z } from "zod";

/**
 * `POST /api/v1/creative-stress-test` — the Builder page's "Run Simulation" (renamed: "Jalankan
 * Uji Ketahanan") payload. First Boundary: persists real input only — no evaluator runs yet, see
 * `StressTestService.execute` for the honest `WAITING_FOR_ENGINE` transition.
 */
export const CreateStressTestRunBodySchema = z
  .object({
    name: z.string().trim().min(1),
    sourceType: z.enum(["LISTING", "CAMPAIGN", "CAMPAIGN_DRAFT", "CREATIVE_PACKAGE"]),
    listingId: z.string().trim().min(1).optional(),
    campaignId: z.string().trim().min(1).optional(),
    campaignDraftId: z.string().trim().min(1).optional(),
    creativeIds: z.array(z.string().trim().min(1)).default([]),
    mode: z.enum(["FAST", "STANDARD", "DEEP"]).default("STANDARD"),
    primaryGoal: z
      .enum(["CPQL", "HOT_LEAD_RATE", "CREATIVE_QUALITY", "MESSAGING_FIT"])
      .default("CREATIVE_QUALITY"),
    personaIds: z
      .array(
        z.enum(["PRICE_SENSITIVE", "SKEPTICAL_BUYER", "HIGH_INTENT", "INVESTOR", "FAMILY_BUYER"]),
      )
      .min(1),
    objectionSources: z
      .array(
        z.enum([
          "LISTING_KNOWLEDGE_BASE",
          "FIRST_MESSAGE_INTELLIGENCE",
          "RESPON_PINTAR_CONVERSATIONS",
          "HISTORICAL_OBJECTIONS",
        ]),
      )
      .default([]),
  })
  .refine(
    (body) =>
      (body.sourceType === "LISTING" && body.listingId !== undefined) ||
      (body.sourceType === "CAMPAIGN" && body.campaignId !== undefined) ||
      (body.sourceType === "CAMPAIGN_DRAFT" && body.campaignDraftId !== undefined) ||
      body.sourceType === "CREATIVE_PACKAGE",
    { message: "sourceType requires its matching id field (listingId/campaignId/campaignDraftId)" },
  );
export type CreateStressTestRunBodyDto = z.infer<typeof CreateStressTestRunBodySchema>;
