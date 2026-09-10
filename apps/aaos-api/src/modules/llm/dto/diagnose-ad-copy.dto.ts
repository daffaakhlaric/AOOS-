import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * `LlmService.diagnoseAdCopy` request context — AAOS Samantha Professional Optimizer, Part C.
 * Real, already-pulled per-ad data from `@aos/meta-ads-connector`'s `Ad` domain entity (Part B's
 * `primaryText`/`headline`/`description`, Part A's parent-adset `learningStatus`) plus this ad's
 * real, already-computed `verdict`/metrics — NOTHING here is re-derived or re-thresholded by this
 * DTO or by `LlmService`; the caller passes through the SAME real numbers/verdict
 * `VerdictEngine`/`AdMetrics` already computed, exactly like `CampaignInsightRequestDto`'s own
 * "verdict nyata dari VerdictEngine, sudah dihitung, JANGAN dihitung ulang" convention.
 *
 * `primaryText`/`headline`/`description` mirror `Ad`'s own optional-field convention 1:1 — all 3
 * can independently be `undefined` when Meta's real creative for this ad doesn't carry them in the
 * one real shape `AdMapper`/`MetaApiRequestBuilder` cover (see those files' own docs). When all 3
 * are `undefined`, `LlmService.diagnoseAdCopy` short-circuits to a real, honest `available: false`
 * (`reason: "NO_COPY_TEXT"`) BEFORE ever calling OpenAI — see that method's own doc.
 */
export const DiagnoseAdCopyRequestSchema = z.object({
  adName: z.string().min(1),
  primaryText: z.string().optional(),
  headline: z.string().optional(),
  description: z.string().optional(),
  /** Real verdict already computed by `VerdictEngine.evaluateVerdict` — never recomputed here. */
  verdict: z.string().min(1),
  /** Real, honest "is this ad underperforming" signal the caller already has (e.g. `verdict === "PAUSE" || verdict === "REVIEW"`) — reused, not a new threshold invented by this DTO/prompt. Gates whether the LLM is asked for a Pain/Offer/USP diagnosis at all (see `diagnoseAdCopy`'s own doc). */
  isUnderperforming: z.boolean(),
  spend: z.number().nonnegative(),
  conversations: z.number().nonnegative(),
  /** Real `Rp/chat` — `null` when undefined (0 conversations), same convention `Rph`'s own `.value` already uses elsewhere in this codebase. */
  rphChatIDR: z.number().nonnegative().nullable(),
  frequency: z.number().nonnegative(),
  /**
   * AAOS Samantha Professional Optimizer, Part A — the real parent adset's
   * `learning_stage_info.status`, when Meta reported one. `undefined` when Meta didn't (see
   * `@aos/meta-ads-connector`'s `AdSet.learningStatus` docstring for when that happens) — treated
   * by the prompt identically to `"SUCCESS"`/`"LEARNING_LIMITED"` (no special learning-phase framing
   * unless it is genuinely `"LEARNING"`).
   */
  learningStatus: z.enum(["LEARNING", "LEARNING_LIMITED", "SUCCESS"]).optional(),
});
export type DiagnoseAdCopyRequestDto = z.infer<typeof DiagnoseAdCopyRequestSchema>;

const STRUCTURAL_STATUSES = ["YES", "NO", "PARTIAL"] as const;

const StructuralElementSchema = z.object({
  status: z.enum(STRUCTURAL_STATUSES),
  /** Real, grounded reasoning — never a fabricated score with no basis (see `diagnoseAdCopy`'s own doc). */
  reasoning: z.string().min(1),
});

const DIAGNOSIS_ISSUES = ["PAIN", "OFFER", "USP", "UNCERTAIN"] as const;

/**
 * `diagnosis.issue` real vocabulary — the whiteboard's 3 real diagnostic criteria ("Pain tidak
 * ada", "Offer tidak menarik", "USP ga ada") plus a real, honest 4th option (`UNCERTAIN`) for when
 * the LLM's own confidence genuinely isn't high enough to commit to one of the 3 — never forced to
 * fabricate confidence the evidence doesn't support.
 */
const DiagnosisSchema = z.object({
  issue: z.enum(DIAGNOSIS_ISSUES),
  reasoning: z.string().min(1),
});

export const DiagnoseAdCopyLlmPayloadSchema = z.object({
  structural: z.object({
    hook: StructuralElementSchema,
    clearProblem: StructuralElementSchema,
    toThePoint: StructuralElementSchema,
    softCta: StructuralElementSchema,
  }),
  /**
   * `undefined` when `isUnderperforming` was `false` in the request (the prompt is instructed not
   * to diagnose a genuinely healthy ad) — a real, honest "nothing to diagnose" absence, not an
   * empty/placeholder object.
   */
  diagnosis: DiagnosisSchema.optional(),
  /**
   * Real Learning Phase lead-in text, present ONLY when the request's `learningStatus === "LEARNING"`
   * — the prompt is instructed to lead with this and temper the rest of the analysis accordingly
   * (same real professional-practice principle as `VerdictEngine`'s own Part A suppression).
   */
  learningPhaseNote: z.string().optional(),
});
export type DiagnoseAdCopyLlmPayload = z.infer<typeof DiagnoseAdCopyLlmPayloadSchema>;

export type DiagnoseAdCopyResponseDto =
  ({ readonly available: true } & DiagnoseAdCopyLlmPayload) | LlmUnavailableResponseDto;
