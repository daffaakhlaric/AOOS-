import { z } from "zod";

import type { ImprovementPlanRequestDto } from "./improvement-plan.dto.js";
import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * `LlmService.selfAnalyze` request context (AAOS Self-Improving, Phase SI-3 — a real, SEPARATE
 * root-cause LLM call, made BEFORE `generateImprovementPlan`). Deliberately the SAME real shape as
 * `ImprovementPlanRequestDto` — the design doc's own Phase SI-3 instruction is explicit: "reuse the
 * SAME real gap data (`DetectedGap`/`DetectedLiveRunGap`, `currentPromptContent`,
 * `recentProposals`) `generateImprovementPlan` already receives — do not invent a second, parallel
 * data-fetching path". `LearningService` builds ONE real context object per trigger
 * (`onSimulationComplete`/`onAgentRunJudged`) and passes it to `selfAnalyze` first, then again
 * (with `selfAnalysis` now populated) to `generateImprovementPlan` — never a second, differently-
 * shaped fetch. `selfAnalysis` itself is naturally `undefined` on the request INTO `selfAnalyze`
 * (there is no self-analysis-of-a-self-analysis) — this is simply a type alias, not a narrowed
 * schema, so no separate Zod schema is declared here.
 */
export type SelfAnalysisRequestDto = ImprovementPlanRequestDto;

/**
 * The shape Samantha's `self_analyze_gap` system prompt asks the model to return — real,
 * LLM-generated root-cause hypotheses (`rootCauses`), a real observation about trends across
 * `recentProposals`/prior runs already given in the request (`patterns`), and a real, honest
 * self-reported confidence (`confidence`, 0-1 — NOT a fabricated-sounding 0-100 precision score,
 * same "no fabricated precise numbers" discipline `ImprovementItemSchema`'s own `severity` field
 * documents on itself for `generateImprovementPlan`).
 */
export const SelfAnalysisLlmPayloadSchema = z.object({
  rootCauses: z.array(z.string().min(1)).min(1),
  patterns: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export type SelfAnalysisLlmPayload = z.infer<typeof SelfAnalysisLlmPayloadSchema>;

export type SelfAnalysisResponseDto =
  ({ readonly available: true } & SelfAnalysisLlmPayload) | LlmUnavailableResponseDto;
