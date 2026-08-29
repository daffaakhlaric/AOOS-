import { Branch } from "@aos/meta-ads-connector";
import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * One REAL candidate interest handed to Samantha, sourced from the `meta_interests` table (itself
 * populated only by real live `GET /search?type=adinterest` calls). The model may ONLY choose from
 * these — see `SelectTargetingLlmPayloadSchema` and `LlmService.selectTargeting`'s server-side
 * candidate-set check.
 */
export const TargetingCandidateSchema = z.object({
  /** Meta's own interest id, e.g. `"6003257869482"`. */
  id: z.string().min(1),
  name: z.string().min(1),
  audienceSizeLower: z.number(),
  audienceSizeUpper: z.number(),
  topic: z.string().optional(),
});
export type TargetingCandidateDto = z.infer<typeof TargetingCandidateSchema>;

/**
 * `LlmService.selectTargeting` request. Mirrors `CreativeBriefRequestSchema`'s pattern: a small
 * prompt-context bag (what is being sold, from which angle, for which branch) plus the real,
 * server-supplied candidate list.
 *
 * `candidates` is capped at 40 — not an arbitrary round number but the point past which the
 * candidate list stops being a focused shortlist and starts being "the whole table", which the
 * coordinator note explicitly rules out ("never sending the LLM more than a reasonable candidate
 * set"). The caller filters down to relevance before calling; this schema fails closed if it
 * doesn't.
 */
export const SelectTargetingRequestSchema = z.object({
  unit: z.string().min(1),
  angle: z.string().min(1).optional(),
  branch: z.nativeEnum(Branch),
  candidates: z.array(TargetingCandidateSchema).min(1).max(40),
});
export type SelectTargetingRequestDto = z.infer<typeof SelectTargetingRequestSchema>;

/**
 * The shape Samantha's `select-targeting` system prompt asks the model to return: the chosen
 * interest IDs plus a one-line Indonesian rationale.
 *
 * `interestIds` passing THIS schema is necessary but NOT sufficient — Zod can only check that the
 * ids are non-empty strings, not that they are ids the model was actually shown. `LlmService.
 * selectTargeting` additionally intersects the response against the real candidate id set and
 * drops anything invented (coordinator note: never trust an LLM to only pick from what it was
 * given). A response that contains NOTHING but invented ids is treated as `INVALID_RESPONSE`.
 */
export const SelectTargetingLlmPayloadSchema = z.object({
  interestIds: z.array(z.string().min(1)).min(1),
  reasoning: z.string().min(1),
});
export type SelectTargetingLlmPayload = z.infer<typeof SelectTargetingLlmPayloadSchema>;

/** The validated selection: only ids that were really in the candidate set survive into `interestIds`. */
export interface SelectTargetingSelectionDto {
  readonly interestIds: readonly string[];
  readonly reasoning: string;
  /**
   * Ids the model returned that were NOT in the candidate set it was shown, recorded rather than
   * silently swallowed — a real, inspectable signal that the model hallucinated. Always dropped
   * from `interestIds`.
   */
  readonly rejectedIds: readonly string[];
}

export type SelectTargetingResponseDto =
  ({ readonly available: true } & SelectTargetingSelectionDto) | LlmUnavailableResponseDto;
