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

/**
 * Real, honest bound on a single bulk-publish batch (user-requested scope: "Publish otomatis
 * creative dalam jumlah besar (8-25) langsung ke Meta" — up to now hard-capped at 3, one real ad per
 * `variantLabel`). 25 is the user's own stated upper bound; below that, `MIN_VARIANT_COUNT` stays at
 * 1 so every pre-existing caller that never sets `targetCount` keeps its old, real 3-variant default
 * (see `DEFAULT_VARIANT_COUNT`) — this widening is additive, never a behavior change for existing
 * callers.
 */
export const MAX_VARIANT_COUNT = 25;
export const MIN_VARIANT_COUNT = 1;
export const DEFAULT_VARIANT_COUNT = 3;

export const AdCopyVariantsRequestSchema = z.object({
  listingTitle: z.string().min(1),
  propertyType: z.string().min(1),
  /** A real `PropertyAdAngle` member string (e.g. `DP_RINGAN`, `READY_HUNI`) — see `PropertyAdAngle` for the full real vocabulary. */
  angle: z.string().min(1),
  price: z.number().positive().optional(),
  city: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  /**
   * Real, bulk-publish widening: how many DISTINCT ad-copy variants to generate this call, honestly
   * bounded to what a single LLM completion can produce as structurally-distinct copy in one JSON
   * response (same `MAX_DIVERSE_BRIEF_COUNT` discipline `diverse-creative-brief-set.dto.ts` already
   * establishes for the sibling Kai diverse-creative-brief flow). Defaults to the original, pre-
   * existing 3 (A/B/C Meta-native-testing convention) so every caller that never sets this keeps its
   * exact prior behavior.
   */
  targetCount: z.number().int().min(MIN_VARIANT_COUNT).max(MAX_VARIANT_COUNT).optional(),
});
export type AdCopyVariantsRequestDto = z.infer<typeof AdCopyVariantsRequestSchema>;

/**
 * Widened from the original fixed `["A", "B", "C"]` to support up to `MAX_VARIANT_COUNT` real,
 * distinctly-labeled ads per ad set. Letters (never numbers) to stay visually consistent with the
 * pre-existing A/B/C convention every real caller/UI (`StoredCopyVariant`, `CopyVariantSelector`,
 * `AbTestingClient`) already renders — `ctaForVariantLabel`'s own "B = Pelajari Selanjutnya, every
 * other letter = Tanya Sekarang" rule (`creative-packages.service.ts`) still applies unchanged to
 * any of these labels.
 */
const VARIANT_LABELS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
] as const;

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
 * `LlmService.generateAdCopyVariants`'s real LLM output shape. Originally exactly 3 variants
 * (A/B/C); widened (bulk-publish scope) to 1-`MAX_VARIANT_COUNT`, honestly NOT hard-pinned to the
 * caller's own `targetCount` — same "an LLM asked for N deliberately-different angles may honestly
 * return fewer than N" reasoning `DiverseCreativeBriefSetLlmPayloadSchema`'s own doc already
 * establishes, since Meta's real ad-copy-angle space is not infinite either. `variantLabel` uses the
 * SAME `variantLabel` convention `StoredCopyVariant`/`PropertyCopyVariant` already use — no new
 * enum, just a wider one. `callToAction` is deliberately NOT asked of the LLM —
 * `PropertyCopyBuilder`'s own 2-member `CTA_DIRECT`/`CTA_LEARN` vocabulary is a real, curated,
 * Indonesian-market-tested set; `LlmService.generateAdCopyVariants`'s real caller
 * (`CreativePackagesService.generateProperty`) fills `callToAction` in deterministically from that
 * same real vocabulary rather than trusting the LLM to invent a fresh CTA string Meta might not
 * even support as a real `call_to_action.type`.
 */
export const AdCopyVariantsLlmPayloadSchema = z.object({
  variants: z.array(AdCopyVariantLlmSchema).min(MIN_VARIANT_COUNT).max(MAX_VARIANT_COUNT),
});
export type AdCopyVariantsLlmPayload = z.infer<typeof AdCopyVariantsLlmPayloadSchema>;

export type AdCopyVariantsResponseDto =
  ({ readonly available: true } & AdCopyVariantsLlmPayload) | LlmUnavailableResponseDto;
