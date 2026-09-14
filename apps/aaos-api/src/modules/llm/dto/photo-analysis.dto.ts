import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * `LlmService.analyzePropertyPhoto` — Kai Creative Engine Sprint 1. Investigated directly before
 * writing this: the pasted spec's `KaiPhotoAnalyzerService` called `@anthropic-ai/sdk` directly,
 * bypassing this codebase's real, single LLM gateway (`OpenAiClient`, injected into `LlmService` —
 * every other AI call in this app, including `generateDiverseCreativeBriefSet`, goes through it).
 * This DTO/method reuses that same gateway instead of adding a second, parallel LLM client.
 *
 * `scene`/`recommendedUse` are a deliberately SMALL, honest vocabulary — not the pasted spec's
 * larger one (`interior_kamar_mandi`, `balkon`, `view`, …), which invents distinctions this app has
 * no downstream use for yet (no per-scene creative template exists — see `PropertyPromptBuilder`).
 * Kept small on purpose: every value here is something a real caller (`assignPhotosToCreative`-style
 * hero-photo selection) can actually act on today; growing the vocabulary is cheap later, walking
 * back a published enum value is not.
 */
export const PHOTO_SCENE_VALUES = [
  "EKSTERIOR",
  "INTERIOR",
  "FASILITAS",
  "DENAH",
  "LAINNYA",
] as const;
export type PhotoScene = (typeof PHOTO_SCENE_VALUES)[number];

export const PHOTO_RECOMMENDED_USE_VALUES = ["HERO", "SUPPORTING", "NOT_RECOMMENDED"] as const;
export type PhotoRecommendedUse = (typeof PHOTO_RECOMMENDED_USE_VALUES)[number];

export const PhotoAnalysisRequestSchema = z.object({
  photoUrl: z.string().url(),
});
export type PhotoAnalysisRequestDto = z.infer<typeof PhotoAnalysisRequestSchema>;

const SCORE_MIN = 0;
const SCORE_MAX = 100;

const PhotoAnalysisLlmSchema = z.object({
  scene: z.enum(PHOTO_SCENE_VALUES),
  /** How visually clear/professional the photo itself is (lighting, sharpness, composition) — independent of what it's a photo OF. */
  qualityScore: z.number().min(SCORE_MIN).max(SCORE_MAX),
  /** How well this specific photo is likely to work as Meta ad creative (emotional appeal, hero-shot potential) — can differ from `qualityScore` (a technically sharp photo of a cramped hallway is still a weak marketing photo). */
  marketingScore: z.number().min(SCORE_MIN).max(SCORE_MAX),
  recommendedUse: z.enum(PHOTO_RECOMMENDED_USE_VALUES),
  /** Real, honest justification grounded in what the model actually saw — never a template string. */
  reasoning: z.string().min(1),
});
export type PhotoAnalysisLlmPayload = z.infer<typeof PhotoAnalysisLlmSchema>;

export const PhotoAnalysisLlmPayloadSchema = PhotoAnalysisLlmSchema;

export type PhotoAnalysisResponseDto =
  ({ readonly available: true } & PhotoAnalysisLlmPayload) | LlmUnavailableResponseDto;
