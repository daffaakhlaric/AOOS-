import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * `LlmService.generateAdCopyVariants` request context — AAOS-SAMANTHA-LLM-AD-COPY. Real
 * `PROPERTY`-vertical listing/brief context (Samantha generates PROPERTY ad copy today; there is
 * no real caller for an AUTOMOTIVE unit yet — see `LlmService.generateAdCopyVariants`'s own doc).
 * Deliberately a subset of `PropertyCreativeBrief`'s real fields (`listingTitle`/`propertyType`/
 * `angle`/`price`/`city`/`highlights`) — the same real fields `PropertyCopyBuilder.buildVariants`
 * already consumes to build its deterministic fallback templates, so the LLM prompt and the
 * fallback template are describing the exact same real listing, never two different views of it.
 */
export const AdCopyVariantsRequestSchema = z.object({
  listingTitle: z.string().min(1),
  propertyType: z.string().min(1),
  /** A real `PropertyAdAngle` member string (e.g. `DP_RINGAN`, `READY_HUNI`) — see `PropertyAdAngle` for the full real vocabulary. */
  angle: z.string().min(1),
  price: z.number().positive().optional(),
  city: z.string().optional(),
  highlights: z.array(z.string()).optional(),
});
export type AdCopyVariantsRequestDto = z.infer<typeof AdCopyVariantsRequestSchema>;

const VARIANT_LABELS = ["A", "B", "C"] as const;

/**
 * Meta's real, enforced ad-creative text limits (verified against Meta's Marketing API "Ad
 * Creative" reference): primary text (`message`) 125 chars, headline (`link_data.name`, not sent
 * by this codebase today but the same real convention `CopyBuilder`/`PropertyCopyBuilder` already
 * enforce) 40 chars. `description` has no single hard Meta-enforced character cap documented as
 * strictly as the other two, so it is bounded generously (200) rather than asserting a precise
 * number this codebase cannot verify live.
 */
const PRIMARY_TEXT_MAX_LENGTH = 125;
const HEADLINE_MAX_LENGTH = 40;
const DESCRIPTION_MAX_LENGTH = 200;

const AdCopyVariantLlmSchema = z.object({
  variantLabel: z.enum(VARIANT_LABELS),
  primaryText: z.string().min(1).max(PRIMARY_TEXT_MAX_LENGTH),
  headline: z.string().min(1).max(HEADLINE_MAX_LENGTH),
  description: z.string().min(1).max(DESCRIPTION_MAX_LENGTH),
});

/**
 * `LlmService.generateAdCopyVariants`'s real LLM output shape — exactly 3 variants (A/B/C, the
 * SAME `variantLabel` convention `StoredCopyVariant`/`PropertyCopyVariant` already use — no new
 * enum), each carrying `primaryText`/`headline`/`description`. `callToAction` is deliberately NOT
 * asked of the LLM — `PropertyCopyBuilder`'s own 2-member `CTA_DIRECT`/`CTA_LEARN` vocabulary is a
 * real, curated, Indonesian-market-tested set; `LlmService.generateAdCopyVariants`'s real caller
 * (`CreativePackagesService.generateProperty`) fills `callToAction` in deterministically from that
 * same real vocabulary rather than trusting the LLM to invent a fresh CTA string Meta might not
 * even support as a real `call_to_action.type`.
 */
export const AdCopyVariantsLlmPayloadSchema = z.object({
  variants: z.array(AdCopyVariantLlmSchema).length(3),
});
export type AdCopyVariantsLlmPayload = z.infer<typeof AdCopyVariantsLlmPayloadSchema>;

export type AdCopyVariantsResponseDto =
  ({ readonly available: true } & AdCopyVariantsLlmPayload) | LlmUnavailableResponseDto;
