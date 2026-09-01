import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * `LlmService.generateImprovementPlan` request context (AAOS Self-Learning AI, Phase B — gap
 * detection + LLM-generated improvement PROPOSAL). Composed server-side by `LearningService` from
 * REAL data only — never accepted raw from an HTTP caller (this method has no HTTP endpoint of its
 * own, same "in-process only" precedent `LlmService.selectTargeting` already establishes for a
 * method whose input must be assembled server-side).
 */
const ImprovementPlanGapSchema = z.object({
  /** The real `SimulationScoring` gate this gap was detected from (`domain/scoring.ts`). */
  samanthaCoverageScore: z.number(),
  kaiScore: z.number(),
  claraScore: z.number(),
  overallScore: z.number(),
  grade: z.string(),
  verdict: z.string(),
  /** Real judge notes, per persona (`ClaraPersonaRun.feedbackItems`) — never fabricated. */
  feedbackItems: z.array(z.object({ dimension: z.string(), message: z.string() })),
});

const ImprovementPlanPriorProposalSchema = z.object({
  createdAt: z.string(),
  agent: z.string(),
  analysis: z.string().nullable(),
  status: z.string(),
});

export const ImprovementPlanRequestSchema = z.object({
  tenantId: z.string().min(1),
  /** Which real agent this proposal concerns — SAMANTHA or CLARA (see `LearningService`'s doc for why Kai never reaches this method). */
  agent: z.enum(["SAMANTHA", "CLARA"]),
  gap: ImprovementPlanGapSchema,
  /** The tenant's REAL current active prompt content for `agent`, via `PromptOverrideService.resolve` — never re-fetched a different way. */
  currentPromptKey: z.string().min(1),
  currentPromptContent: z.string(),
  /** Last 3 `learning_proposals` rows for this tenant (any agent), oldest-first — real history, so the LLM doesn't re-propose something already tried. Empty when this is the tenant's first proposal. */
  recentProposals: z.array(ImprovementPlanPriorProposalSchema),
});
export type ImprovementPlanRequestDto = z.infer<typeof ImprovementPlanRequestSchema>;

/**
 * The shape Samantha's `generate_improvement_plan` system prompt asks the model to return. No
 * fabricated numeric `expectedImpact` (the original pasted spec's `expectedImpact: 15` is exactly
 * the kind of fabricated-sounding precise number this codebase's discipline avoids elsewhere — see
 * `domain/scoring.ts`'s own comments on `SIMULATION_CRITERIA`/`WEIGHTS` for how this codebase
 * documents a judgment call instead of inventing false precision). `severity` keeps a qualitative
 * signal instead — a real string, not a fake point estimate.
 */
const ImprovementItemSchema = z.object({
  agent: z.enum(["SAMANTHA", "CLARA"]),
  type: z.enum(["PROMPT_UPDATE", "CONFIG_UPDATE"]),
  /** MUST be a real `prompt_key`/`config_key` — validated server-side by `LlmService.generateImprovementPlan`, never trusted from the LLM alone (belt-and-braces, same discipline `selectTargeting`'s candidate-id intersection / `campaignStrategy`'s angle-membership check already establish). */
  target: z.string().min(1),
  before: z.string(),
  after: z.string(),
  reason: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export const ImprovementPlanLlmPayloadSchema = z.object({
  analysis: z.string().min(1),
  improvements: z.array(ImprovementItemSchema),
});
export type ImprovementPlanLlmPayload = z.infer<typeof ImprovementPlanLlmPayloadSchema>;
export type ImprovementItem = z.infer<typeof ImprovementItemSchema>;

export type ImprovementPlanResponseDto =
  ({ readonly available: true } & ImprovementPlanLlmPayload) | LlmUnavailableResponseDto;
