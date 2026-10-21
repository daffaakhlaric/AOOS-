import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * Creative Stress Test, Second Boundary — the ONE real creative-under-test shape all 3 new
 * `LlmService` evaluator methods below share. Built by `CreativeStressTestService` from whichever
 * REAL source actually exists for a given run:
 * - A real `StoredCreativePackage`'s own `copyVariants[0]`/`imageUrls`/`videoUrl`/`angle`
 *   (`sourceType: "CAMPAIGN"`, `creativeIds` = real creative-package ids).
 * - A real `listings` row's `title`/`description`/`price` standing in for ad copy that was never
 *   written (`sourceType: "LISTING"`, `creativeIds` = real listing-photo ids — a listing has no
 *   Meta/Kai copy of its own). `isProxyFromListing: true` in this case — the prompt is instructed
 *   to never claim this is "the ad copy", only "the listing's real facts used as a copy proxy".
 *
 * `format` is always a TEXTUAL description (e.g. "IMAGES_ONLY", "VIDEO_AND_IMAGES") — no image
 * bytes/URLs are ever sent to the LLM here. `OpenAiClient` DOES support vision (`image_url` content
 * parts — see `analyzePropertyPhoto`/`assessPropertyCreativeIntegrity`), but these 3 stress-test
 * evaluators deliberately do NOT use it: the spec's own honesty instruction is that a "the visual is
 * compelling" claim must never be made unless a vision model actually looked at the image, and Kai
 * Creative Engine's Sprint 1/EYVRA Phase 31 vision calls are a SEPARATE, already-scoped concern this
 * boundary does not extend. Every evaluator here reasons over real TEXTUAL creative metadata only.
 */
export const StressTestCreativeUnderTestSchema = z.object({
  primaryText: z.string().optional(),
  headline: z.string().optional(),
  description: z.string().optional(),
  angle: z.string().optional(),
  format: z.string().optional(),
  /**
   * `true` when `primaryText`/`headline`/`description` above are actually a real listing's
   * title/description/price (no real ad copy exists for this run) — see this schema's own doc.
   * `false` when they are a real creative package's own real copy variant text.
   */
  isProxyFromListing: z.boolean(),
});
export type StressTestCreativeUnderTest = z.infer<typeof StressTestCreativeUnderTestSchema>;

/**
 * True when at least one of `primaryText`/`headline`/`description` is a real, non-empty string —
 * the one honest gate all 3 evaluators below share before ever calling OpenAI (mirrors
 * `diagnoseAdCopy`'s own `NO_COPY_TEXT` short-circuit, reusing the SAME "don't invite the LLM to
 * hallucinate an analysis of text it was never given" discipline).
 */
export function hasRealCreativeText(creative: StressTestCreativeUnderTest): boolean {
  return (
    (creative.primaryText?.trim().length ?? 0) > 0 ||
    (creative.headline?.trim().length ?? 0) > 0 ||
    (creative.description?.trim().length ?? 0) > 0
  );
}

// ---------------------------------------------------------------------------------------------
// 1. Buyer Persona Simulation — the core adversarial stress test.
// ---------------------------------------------------------------------------------------------

/**
 * `LlmService.simulateStressTestPersona` request — ONE real, static `PersonaPreset` (see
 * `modules/creative-stress-test/domain/persona-presets.ts`) reacting to ONE real creative. Never a
 * lead-derived persona (`PersonaBuilder` is explicitly out of scope this boundary — no real
 * objection/first-message data exists to derive one from).
 */
export const StressTestPersonaSimulationRequestSchema = z.object({
  personaId: z.string().min(1),
  personaLabel: z.string().min(1),
  personaDescription: z.string().min(1),
  primaryGoal: z.string().min(1),
  creative: StressTestCreativeUnderTestSchema,
});
export type StressTestPersonaSimulationRequestDto = z.infer<
  typeof StressTestPersonaSimulationRequestSchema
>;

const OBJECTION_SEVERITIES = ["HIGH", "MEDIUM", "LOW"] as const;

/**
 * `severity` is an LLM-ASSESSED plausibility/impact label, never a fabricated frequency
 * percentage (the user's own explicit instruction — no real historical buyer data exists to compute
 * "82% of buyers object to this" from; a severity label the LLM assigns from reasoning about the
 * persona + creative is honest, a fabricated statistic is not).
 */
const StressTestSimulatedObjectionSchema = z.object({
  objection: z.string().min(1),
  severity: z.enum(OBJECTION_SEVERITIES),
});

export const StressTestPersonaSimulationLlmPayloadSchema = z.object({
  /** What genuinely attracts this persona about the creative — grounded in the real copy given. */
  attracts: z.array(z.string().min(1)).min(1),
  /** What confuses/repels this persona — may be empty (a real, honest "nothing confusing" case). */
  confusions: z.array(z.string().min(1)).default([]),
  objections: z.array(StressTestSimulatedObjectionSchema).default([]),
  /** What would concretely increase this persona's intent (real, specific, grounded suggestions). */
  intentDrivers: z.array(z.string().min(1)).default([]),
  /** A short first-person-style narrative of this persona's simulated reaction — the human-readable summary the UI leads with. */
  narrativeReaction: z.string().min(1),
});
export type StressTestPersonaSimulationLlmPayload = z.infer<
  typeof StressTestPersonaSimulationLlmPayloadSchema
>;

/**
 * `simulated: true` is ALWAYS present on the success branch — the one field the frontend/report
 * checks to render the "Hasil simulasi AI berdasarkan persona preset — bukan data pembeli nyata"
 * notice (mirrors the existing persona-preset honesty label already shipped in
 * `StressTestBuilder.tsx`). Never omitted, never settable to `false`.
 */
export type StressTestPersonaSimulationResponseDto =
  | ({ readonly available: true; readonly simulated: true } & StressTestPersonaSimulationLlmPayload)
  | LlmUnavailableResponseDto;

// ---------------------------------------------------------------------------------------------
// 2. Copy Evaluator.
// ---------------------------------------------------------------------------------------------

export const StressTestCopyEvaluationRequestSchema = z.object({
  primaryGoal: z.string().min(1),
  creative: StressTestCreativeUnderTestSchema,
});
export type StressTestCopyEvaluationRequestDto = z.infer<
  typeof StressTestCopyEvaluationRequestSchema
>;

const COPY_DIMENSION_STATUSES = ["STRONG", "ADEQUATE", "WEAK"] as const;
const StressTestCopyDimensionSchema = z.object({
  status: z.enum(COPY_DIMENSION_STATUSES),
  reasoning: z.string().min(1),
});

export const StressTestCopyEvaluationLlmPayloadSchema = z.object({
  hookClarity: StressTestCopyDimensionSchema,
  offerStrength: StressTestCopyDimensionSchema,
  ctaSpecificity: StressTestCopyDimensionSchema,
  internalConsistency: StressTestCopyDimensionSchema,
  summary: z.string().min(1),
});
export type StressTestCopyEvaluationLlmPayload = z.infer<
  typeof StressTestCopyEvaluationLlmPayloadSchema
>;

export type StressTestCopyEvaluationResponseDto =
  ({ readonly available: true } & StressTestCopyEvaluationLlmPayload) | LlmUnavailableResponseDto;

// ---------------------------------------------------------------------------------------------
// 3. Fact / Claim Validator — grounded in real `listing-knowledge` retrieval hits.
// ---------------------------------------------------------------------------------------------

/**
 * `LlmService.validateStressTestClaims` request — ONLY ever called by `CreativeStressTestService`
 * when `listingKnowledgeService.retrieve` returned at least 1 real hit (see that service's own
 * doc); when no real Listing Knowledge exists for the run's listing, the honest "tidak dapat
 * diverifikasi" result is produced WITHOUT calling this method at all (no LLM call, no invented
 * pass-all-claims result).
 */
export const StressTestFactValidationRequestSchema = z.object({
  creative: StressTestCreativeUnderTestSchema,
  knowledgeExcerpts: z
    .array(
      z.object({
        documentId: z.string().min(1),
        fileName: z.string().min(1),
        excerpt: z.string().min(1),
      }),
    )
    .min(1),
});
export type StressTestFactValidationRequestDto = z.infer<
  typeof StressTestFactValidationRequestSchema
>;

const CLAIM_STATUSES = ["SUPPORTED", "UNSUPPORTED_CLAIM", "CONFLICTING_CLAIM"] as const;

const StressTestClaimFindingSchema = z.object({
  claim: z.string().min(1),
  status: z.enum(CLAIM_STATUSES),
  reasoning: z.string().min(1),
  /** Real citation into `knowledgeExcerpts` above — present for SUPPORTED/CONFLICTING, `undefined` for UNSUPPORTED_CLAIM (nothing to cite). */
  citationDocumentId: z.string().optional(),
  citationFileName: z.string().optional(),
});

export const StressTestFactValidationLlmPayloadSchema = z.object({
  /** One entry per real claim-like statement found in `creative`'s copy. Empty array is a real, honest "no verifiable factual claims in this copy" outcome. */
  findings: z.array(StressTestClaimFindingSchema).default([]),
});
export type StressTestFactValidationLlmPayload = z.infer<
  typeof StressTestFactValidationLlmPayloadSchema
>;

export type StressTestFactValidationResponseDto =
  ({ readonly available: true } & StressTestFactValidationLlmPayload) | LlmUnavailableResponseDto;

// ---------------------------------------------------------------------------------------------
// 4. Objection Resolution + Goal Impact evaluator.
// ---------------------------------------------------------------------------------------------

/**
 * `LlmService.evaluateStressTestObjectionResolution` request. Only ever built by
 * `CreativeStressTestService` AFTER persona simulation settled, from:
 * - `creative`: the exact creative text the other evaluators saw (evidence quotes are verified
 *   against it server-side — see `modules/creative-stress-test/domain/objection-resolution.ts`);
 * - `listingFacts`: real structured listing fields (only fields that actually have a value);
 * - `knowledgeExcerpts`: the same real Listing Knowledge hits the Fact Validator used (may be empty);
 * - `objections`: the run's real simulated objections, grouped by `normalizeObjectionText`, each
 *   with a per-run `id` ("o1", "o2", …) the response must echo back.
 */
export const StressTestObjectionResolutionRequestSchema = z.object({
  primaryGoal: z.string().min(1),
  creative: StressTestCreativeUnderTestSchema,
  listingFacts: z.record(z.union([z.string(), z.number(), z.array(z.string())])),
  knowledgeExcerpts: z.array(
    z.object({
      documentId: z.string().min(1),
      fileName: z.string().min(1),
      excerpt: z.string().min(1),
    }),
  ),
  objections: z
    .array(
      z.object({
        id: z.string().min(1),
        objection: z.string().min(1),
        severity: z.enum(OBJECTION_SEVERITIES),
        personaLabels: z.array(z.string()),
      }),
    )
    .min(1),
});
export type StressTestObjectionResolutionRequestDto = z.infer<
  typeof StressTestObjectionResolutionRequestSchema
>;

const RESOLUTION_STATUSES = [
  "UNRESOLVED",
  "PARTIAL",
  "RESOLVED",
  "REQUIRES_KNOWLEDGE",
  "REQUIRES_SALES",
  "NOT_SOLVABLE_IN_CREATIVE",
] as const;
const GOAL_IMPACTS = ["VERY_HIGH", "HIGH", "MEDIUM", "LOW"] as const;

export const StressTestObjectionResolutionLlmPayloadSchema = z.object({
  assessments: z.array(
    z.object({
      id: z.string().min(1),
      resolutionStatus: z.enum(RESOLUTION_STATUSES),
      goalImpact: z.enum(GOAL_IMPACTS),
      shortRecommendation: z.string().min(1),
      /** Verbatim quote from the creative text, or null. Verified server-side before persisting. */
      evidence: z.string().nullable().default(null),
    }),
  ),
});
export type StressTestObjectionResolutionLlmPayload = z.infer<
  typeof StressTestObjectionResolutionLlmPayloadSchema
>;

/**
 * RAW (unverified) LLM assessments. `simulated: true` marks every status/impact as an AI
 * assessment. The caller MUST run `verifyObjectionAssessments` before persisting/showing them.
 */
export type StressTestObjectionResolutionResponseDto =
  | ({
      readonly available: true;
      readonly simulated: true;
    } & StressTestObjectionResolutionLlmPayload)
  | LlmUnavailableResponseDto;
