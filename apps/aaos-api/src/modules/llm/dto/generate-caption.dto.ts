import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * The spec's "Tipe Konten" chips (`PROMPT-AAOS-SOSMED-AUTOMATION.md`'s Content Studio Step 1) —
 * kept as a local enum here rather than importing from `modules/sosmed` to avoid a dependency
 * cycle (`modules/sosmed` will depend on `LlmService`, not the other way around). Column-for-column
 * with `scheduled_posts.content_type` in `supabase/migrations/014_sosmed.sql`.
 */
export const SosmedContentTypeSchema = z.enum([
  "PROMO",
  "EDUKASI",
  "TESTIMONI",
  "BTS",
  "TIPS",
  "MARKET_UPDATE",
]);

export const SosmedToneSchema = z.enum(["FRIENDLY", "PROFESSIONAL", "EXCITED", "INFORMATIVE"]);

/**
 * `AUTOMOTIVE`/`PROPERTY` — same literal union used throughout this app (e.g.
 * `modules/superadmin/dto/tenant-response.dto.ts`'s `vertical` field); there is no shared
 * `@aos/*` package export for it today, so it is repeated here rather than invented as a new
 * cross-package type.
 */
export const SosmedVerticalSchema = z.enum(["AUTOMOTIVE", "PROPERTY"]);

/**
 * `LlmService.generateCaption` request — the Content Studio Step 1 brief (content type,
 * product/unit reference, angle, tone, vertical). `productRef` is deliberately a loose
 * prompt-context string (e.g. "Xpander Cross 2019 - Cinere, DP mulai 29 juta"), same precedent as
 * `CreativeBriefAdContextSchema.name` — the caller assembles it from the real unit/listing record,
 * this endpoint only needs it described for the prompt.
 */
export const GenerateCaptionRequestSchema = z.object({
  contentType: SosmedContentTypeSchema,
  productRef: z.string().min(1),
  angle: z.string().min(1),
  tone: SosmedToneSchema,
  vertical: SosmedVerticalSchema,
});
export type GenerateCaptionRequestDto = z.infer<typeof GenerateCaptionRequestSchema>;

/**
 * The shape Tamara's caption-generation system prompt asks the model to return — one shorter IG
 * caption and one longer, storytelling FB caption, per the spec's Content Studio Step 2 mockup.
 * Hashtags are deliberately NOT part of this payload — `generateHashtags` is a separate endpoint
 * with its own prompt/schema, matching the two distinct buttons ("Generate Konten" vs "Regenerate
 * hashtag") the spec's UI shows.
 */
export const GenerateCaptionLlmPayloadSchema = z.object({
  instagramCaption: z.string().min(1),
  facebookCaption: z.string().min(1),
});
export type GenerateCaptionLlmPayload = z.infer<typeof GenerateCaptionLlmPayloadSchema>;

export type GenerateCaptionResponseDto =
  ({ readonly available: true } & GenerateCaptionLlmPayload) | LlmUnavailableResponseDto;
