import { z } from "zod";

/** The literal string a `POST /api/v1/simulation/:id/go-live` caller must send — checked server-side (coordinator note section 6), never trusted from any client-side confirmation dialog alone. */
export const GO_LIVE_CONFIRMATION_TEXT = "GO LIVE";

const GoLiveCreativeVideoSchema = z.object({
  assetType: z.literal("VIDEO"),
  /** A real, already-hosted (GCS) video URL — the Simulasi wizard's already-generated creative package output. */
  hostedUrl: z.string().url(),
  /** Meta's `video_data.image_url` requires a real thumbnail image URL. */
  thumbnailUrl: z.string().url(),
  primaryText: z.string().min(1),
  headline: z.string().min(1).optional(),
});

const GoLiveCreativeImageSchema = z.object({
  assetType: z.literal("IMAGE"),
  hostedUrl: z.string().url(),
  primaryText: z.string().min(1),
  headline: z.string().min(1).optional(),
});

export const GoLiveBodySchema = z.object({
  /** Must exactly equal `GO_LIVE_CONFIRMATION_TEXT` — `GoLiveService.execute` rejects the whole request before any external call if it doesn't. */
  confirmation: z.string(),
  /** Whole-IDR daily budget for the new ad set — checked server-side against `objective.budget / 30` before any external call. */
  dailyBudgetIDR: z.number().int().positive(),
  creative: z.discriminatedUnion("assetType", [
    GoLiveCreativeVideoSchema,
    GoLiveCreativeImageSchema,
  ]),
});
export type GoLiveBodyDto = z.infer<typeof GoLiveBodySchema>;
