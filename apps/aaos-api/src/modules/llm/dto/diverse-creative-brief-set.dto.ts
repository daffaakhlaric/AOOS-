import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * `LlmService.generateDiverseCreativeBriefSet` — Samantha Andromeda-Aware Campaign System, Sprint 2.
 * Kai's diverse-creative-set brief generation: given ONE real PROPERTY listing + a bounded target
 * count, produces N briefs that are structurally REQUIRED to differ from each other AND from the
 * campaign's real, already-in-use angles — the real fix `evaluateAndromedaRestructureCandidate`
 * (Sprint 1) detects a need for ("LOW_DIVERSITY": too many ads share the same literal creative
 * asset), addressed one layer up the pipeline (never enough NEW diverse creative *briefs* exist to
 * choose from) rather than downstream at the Meta ad-set-consolidation layer Sprint 1 already
 * guardrails.
 *
 * TAXONOMY REUSE (no new vocabulary invented): `angle` is a real `PropertyAdAngle` member — the
 * SAME 8-value enum (`packages/creative-agent`'s `DP_RINGAN`/`READY_HUNI`/`INVESTASI`/`EXCLUSIVE`/
 * `SYARIAH`/`PROMO_TERBATAS`/`TESTIMONIAL`/`VIRTUAL_TOUR`) `AdCopyVariantsRequestDto.angle`/
 * `PropertyCopyBuilder`/`CreativePackagesService.generateProperty` already use — never the pasted
 * spec's fabricated `hookType`/`targetPersona`/`messageAngle` taxonomy (that spec's own vocabulary
 * has no real backing anywhere in this codebase's data model). `format` is `@aos/creative-agent`'s
 * real `CreativeFormat` (`VIDEO_AND_IMAGES` | `IMAGES_ONLY`), the SAME format vocabulary
 * `PropertyFormatDecider`/`CreativePackagesService.generateProperty` already use. `headline`/
 * `primaryText`/`description` are bounded the exact same way `AdCopyVariantsLlmSchema` already
 * bounds them (Meta's real 125/40-char primary-text/headline limits, a generous 200-char description
 * cap) — this is deliberately the closest real precedent to copy, not a fresh invention.
 */
export const ALL_PROPERTY_AD_ANGLE_VALUES = [
  "DP_RINGAN",
  "READY_HUNI",
  "INVESTASI",
  "EXCLUSIVE",
  "SYARIAH",
  "PROMO_TERBATAS",
  "TESTIMONIAL",
  "VIRTUAL_TOUR",
] as const;

export const ALL_CREATIVE_FORMAT_VALUES = ["VIDEO_AND_IMAGES", "IMAGES_ONLY"] as const;

/**
 * Real, honest bound on a single batch request — `generateAdCopyVariants`'s own real Meta-ad-count
 * precedent is exactly 3 (Meta ad sets in this codebase's real A/B-testing convention), but a BRIEF
 * count is not the same real constraint as a PUBLISHED-ad count: not every generated brief becomes a
 * live ad immediately (briefs land in the real, existing `creative_packages` review queue, the SAME
 * queue a single manual/Samantha-recommended brief already goes through — never a direct-to-Meta
 * pipeline). 10 is a judgment call bound generously above the 8-member `PropertyAdAngle` vocabulary
 * itself (so a request could in principle ask for "every angle not yet in use" in one call) while
 * still being small enough that a single LLM completion can honestly produce N structurally-distinct
 * briefs in one JSON response, matching `AdCopyVariantsLlmPayloadSchema.length(3)`'s own "ask for a
 * small, fixed, honestly-achievable count" discipline.
 */
export const MAX_DIVERSE_BRIEF_COUNT = 10;
export const MIN_DIVERSE_BRIEF_COUNT = 1;

export const DiverseCreativeBriefSetRequestSchema = z.object({
  listingTitle: z.string().min(1),
  propertyType: z.string().min(1),
  price: z.number().positive().optional(),
  city: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  /** How many NEW, distinct briefs are being requested this call — already capped server-side (by the real daily `max_auto_briefs_per_day` guardrail remainder, see `CreativePackagesService.createDiverseSet`'s own doc) BEFORE this DTO is built, so this is never the raw, unclamped human/Samantha request. */
  targetCount: z.number().int().min(MIN_DIVERSE_BRIEF_COUNT).max(MAX_DIVERSE_BRIEF_COUNT),
  /**
   * Real `PropertyAdAngle` members already in use on this campaign's existing `creative_packages`
   * rows (the real "diversity requirement" input — see `CreativePackagesService.createDiverseSet`'s
   * own doc for how this is computed). The LLM is asked to avoid these; the server-side validation
   * below (`generateDiverseCreativeBriefSet`) additionally DROPS any returned brief whose angle is in
   * this set, never trusting the prompt alone (same "an LLM is not trusted to only pick from what it
   * was told, no matter what the prompt says" discipline `selectTargeting`/`campaignStrategy` already
   * establish).
   */
  existingAngles: z.array(z.enum(ALL_PROPERTY_AD_ANGLE_VALUES)).default([]),
});
export type DiverseCreativeBriefSetRequestDto = z.infer<
  typeof DiverseCreativeBriefSetRequestSchema
>;

const PRIMARY_TEXT_MAX_LENGTH = 125;
const HEADLINE_MAX_LENGTH = 40;
const DESCRIPTION_MAX_LENGTH = 200;

const DiverseCreativeBriefLlmSchema = z.object({
  angle: z.enum(ALL_PROPERTY_AD_ANGLE_VALUES),
  format: z.enum(ALL_CREATIVE_FORMAT_VALUES),
  headline: z.string().min(1).max(HEADLINE_MAX_LENGTH),
  primaryText: z.string().min(1).max(PRIMARY_TEXT_MAX_LENGTH),
  description: z.string().min(1).max(DESCRIPTION_MAX_LENGTH),
});

/**
 * The real LLM output shape — bounded generously between 1 and `MAX_DIVERSE_BRIEF_COUNT` (never
 * hard-pinned to an exact count, unlike `AdCopyVariantsLlmPayloadSchema.length(3)`: an LLM asked for
 * N deliberately-different angles may honestly return fewer than N when the real, finite
 * `PropertyAdAngle` vocabulary minus `existingAngles` leaves less room than requested — a hard
 * `.length(targetCount)` would incorrectly fail an honest, correctly-constrained response). The
 * real, additional server-side filtering `generateDiverseCreativeBriefSet` performs (dropping
 * `existingAngles` reuse and in-response duplicates) happens AFTER this schema validates shape.
 */
export const DiverseCreativeBriefSetLlmPayloadSchema = z.object({
  briefs: z.array(DiverseCreativeBriefLlmSchema).min(1).max(MAX_DIVERSE_BRIEF_COUNT),
});
export type DiverseCreativeBriefSetLlmPayload = z.infer<
  typeof DiverseCreativeBriefSetLlmPayloadSchema
>;

export type DiverseCreativeBriefSetResponseDto =
  ({ readonly available: true } & DiverseCreativeBriefSetLlmPayload) | LlmUnavailableResponseDto;
