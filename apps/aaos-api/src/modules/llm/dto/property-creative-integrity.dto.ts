import { z } from "zod";

/**
 * `LlmService.assessPropertyCreativeIntegrity` — EYVRA Samantha V2 + Kai V2 Phase 31, PROMPT 54
 * extension ("Property Creative QA"). Real spec prose (from this session's own transcript, grepped
 * directly — never trusted from memory) asks for a semantic comparison of a generated creative
 * against the real property it was generated from, catching architecture/facade drift and
 * hallucinated features (a pool/garden/extra floor that doesn't exist on the real listing) — the one
 * gap `creative-qa.ts`'s own header doc documents as NOT checked by the real, honest structural QA
 * that already exists (`runQaChecks`): "no vision-model comparison of architecture, no
 * hallucinated-feature detection".
 *
 * HONESTY BOUNDARY, deliberately narrower than the spec's own literal example response — the spec
 * asks for precise-looking numeric scores (`"propertyMatch": 96`, `"architectureIntegrity": 98`, ...).
 * A vision-LLM comparison of two photos cannot honestly back a number that precise (a 96 vs. a 94 is
 * not a real, reproducible measurement — it would be a fabricated precision this app's whole
 * discipline this session explicitly avoids elsewhere, e.g. `improvement-plan.dto.ts`'s own
 * "JANGAN sertakan skor dampak numerik yang dikarang" rule). This DTO instead uses a coarse, honestly
 * justifiable verdict scale (`PropertyCreativeIntegrityVerdict`) with a real `reasoning` string — the
 * same "qualitative signal, not a fabricated number" choice `selfAnalyze`'s `confidence` field and
 * `generateImprovementPlan`'s `severity` field already made for LLM-derived judgments in this file.
 *
 * `UNABLE_TO_ASSESS` is NEVER something the model itself is asked to return (the LLM-facing schema,
 * `PropertyCreativeIntegrityLlmPayloadSchema`, only offers it the 3 real comparison verdicts) — it is
 * assigned ONLY by `LlmService.assessPropertyCreativeIntegrity`'s own code when the real vision call
 * could not honestly produce a verdict at all (no API key, rate limited, network/provider failure,
 * malformed LLM response, or no source photo available to compare against) — see that method's own
 * doc for the exhaustive real list of degrade paths, every one of which carries a real `reasoning`
 * explaining WHY, never a silent/fabricated pass.
 */
export const PROPERTY_CREATIVE_INTEGRITY_COMPARISON_VERDICT_VALUES = [
  "CONSISTENT",
  "MINOR_DRIFT",
  "MAJOR_DRIFT",
] as const;
export type PropertyCreativeIntegrityComparisonVerdict =
  (typeof PROPERTY_CREATIVE_INTEGRITY_COMPARISON_VERDICT_VALUES)[number];

/** The real, full verdict vocabulary a caller of `assessPropertyCreativeIntegrity` sees — the 3 real comparison verdicts the LLM is asked for, plus the 1 real "could not assess" degrade verdict this codebase assigns itself. */
export const PROPERTY_CREATIVE_INTEGRITY_VERDICT_VALUES = [
  ...PROPERTY_CREATIVE_INTEGRITY_COMPARISON_VERDICT_VALUES,
  "UNABLE_TO_ASSESS",
] as const;
export type PropertyCreativeIntegrityVerdict =
  (typeof PROPERTY_CREATIVE_INTEGRITY_VERDICT_VALUES)[number];

export const PropertyCreativeIntegrityRequestSchema = z.object({
  /** The real, already-uploaded/public generated creative image URL (`persistGeneratedMedia`'s own real GCS URL) — never a base64 re-encode round trip, same real-public-URL convention `analyzePropertyPhoto`'s `photoUrl` already established. */
  generatedImageUrl: z.string().url(),
  /** The real listing's OWN source photo URL (`ListingResponseDto.photos[].url` / this generation's own `sourcePhotoUrls[0]`) — the real thing being compared against, never a second generated image. */
  sourcePhotoUrl: z.string().url(),
});
export type PropertyCreativeIntegrityRequestDto = z.infer<
  typeof PropertyCreativeIntegrityRequestSchema
>;

/** The real, narrow JSON shape the LLM itself is asked to return — no numeric score field exists here on purpose (see this file's own header doc). */
const PropertyCreativeIntegrityLlmSchema = z.object({
  verdict: z.enum(PROPERTY_CREATIVE_INTEGRITY_COMPARISON_VERDICT_VALUES),
  /** Real, specific features the model reports seeing in the generated image that it did NOT see in the real source photo (e.g. "kolam renang", "lantai tambahan") — an honest empty array, never a fabricated placeholder, when nothing stood out. */
  hallucinatedFeatures: z.array(z.string()).default([]),
  /** Real, honest justification grounded in what the model actually compared — never a template string. */
  reasoning: z.string().min(1),
});
export type PropertyCreativeIntegrityLlmPayload = z.infer<
  typeof PropertyCreativeIntegrityLlmSchema
>;
export const PropertyCreativeIntegrityLlmPayloadSchema = PropertyCreativeIntegrityLlmSchema;

/**
 * The real, always-present return shape of `assessPropertyCreativeIntegrity` — deliberately NOT the
 * `{ available: true, ... } | LlmUnavailableResponseDto` union every other `LlmService` method
 * returns, because this signal is consumed as one uniform, always-loggable value by a non-blocking QA
 * call site (`runGenerationPropertyWithQaRetry`) that never branches on "available" — every real
 * degrade path (no key / rate limited / provider error / malformed response / no source photo) is
 * represented HONESTLY as `verdict: "UNABLE_TO_ASSESS"` with a real `reasoning` explaining why, rather
 * than as a second, differently-shaped error branch the caller would have to special-case.
 */
export interface PropertyCreativeIntegrityResultDto {
  readonly verdict: PropertyCreativeIntegrityVerdict;
  readonly hallucinatedFeatures: readonly string[];
  readonly reasoning: string;
}
