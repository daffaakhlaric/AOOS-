import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * `LlmService.generateImprovementPlan` request context (AAOS Self-Learning AI, Phase B — gap
 * detection + LLM-generated improvement PROPOSAL). Composed server-side by `LearningService` from
 * REAL data only — never accepted raw from an HTTP caller (this method has no HTTP endpoint of its
 * own, same "in-process only" precedent `LlmService.selectTargeting` already establishes for a
 * method whose input must be assembled server-side).
 *
 * `source` is a real, additive discriminant (AAOS-AI-JUDGE-SELF-IMPROVING, Phase J3): a gap can now
 * come from either a SIMULATION (`LearningService.onSimulationComplete`, the original Phase B shape
 * below, unchanged field-for-field) or a real LIVE agent run (`LearningService.onAgentRunJudged`,
 * Phase J3 — a real `judge_results` row's per-agent LLM-judged scores, a genuinely different shape:
 * simulations produce one 3-agent `samanthaCoverageScore`/`kaiScore`/`claraScore` triple, while a
 * live run judges ONE agent against ITS OWN real per-agent dimension vocabulary
 * (`dto/judge-agent-run.dto.ts`'s `SamanthaJudgeScoresSchema`/`ClaraJudgeScoresSchema`) — forcing a
 * live run's single-agent score into the 3-agent triple's `samanthaCoverageScore`/`kaiScore`/
 * `claraScore` fields would fabricate the other two agents' scores, exactly the kind of dishonest
 * schema-forcing this whole effort's discipline avoids elsewhere (see the coordinator note's own
 * `agent_run_id`/`simulation_id` FK reasoning). A `z.discriminatedUnion` keeps both shapes real and
 * separately validated instead.
 */
const SimulationGapSchema = z.object({
  source: z.literal("SIMULATION"),
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

/**
 * AAOS-AI-JUDGE-SELF-IMPROVING, Phase J3 — a real LIVE-run gap, one real judged agent at a time
 * (never SAMANTHA/KAI/CLARA's 3-way triple `SimulationGapSchema` uses — see this const's own doc).
 * `scores` is the run's real per-dimension `judge_results.scores` JSONB (dimension keys genuinely
 * differ per agent — free `record`, not a per-agent-typed shape, same "don't re-declare a second,
 * possibly-drifting copy of `dto/judge-agent-run.dto.ts`'s own 3 per-agent schemas" reasoning that
 * file's own header doc already documents for `context`). `feedbackItems` is real, mapped 1:1 from
 * the SAME judged run's real `judge_results.gaps[]` (`dimension`/`issue`/`suggestion` — never
 * fabricated), reusing the exact field names (`dimension`/`message`) `SimulationGapSchema` already
 * uses so the system prompt's existing "feedbackItems, tiap item punya dimension dan message"
 * instruction stays honestly accurate for both real shapes.
 */
const LiveRunGapSchema = z.object({
  source: z.literal("LIVE_RUN"),
  /** Which real agent this LIVE run judged — SAMANTHA or CLARA only (see `LearningService.onAgentRunJudged`'s own doc for why KAI never reaches this method). */
  agent: z.enum(["SAMANTHA", "CLARA"]),
  /** The real `judge_results.scores.overall` that triggered this proposal (0-100, same real scale `SimulationGapSchema.overallScore` uses). */
  overallScore: z.number(),
  /** Real per-dimension `judge_results.scores` (e.g. `coverage`/`trend_consistency` for SAMANTHA, `outcome_completeness`/`commission_plausibility` for CLARA — see `dto/judge-agent-run.dto.ts`). */
  scores: z.record(z.string(), z.number()),
  /** Real `judge_results` trend vs. this tenant+agent's recent judge history (`AiJudgeService.judgeRun`'s own `memory`). */
  trend: z.enum(["IMPROVING", "STABLE", "DECLINING"]),
  feedbackItems: z.array(z.object({ dimension: z.string(), message: z.string() })),
});

const ImprovementPlanGapSchema = z.discriminatedUnion("source", [
  SimulationGapSchema,
  LiveRunGapSchema,
]);

const ImprovementPlanPriorProposalSchema = z.object({
  createdAt: z.string(),
  agent: z.string(),
  analysis: z.string().nullable(),
  status: z.string(),
});

/**
 * AAOS Self-Improving, Phase SI-3 — the real, additive shape of `LlmService.selfAnalyze`'s
 * SUCCESSFUL output (see `dto/self-analysis.dto.ts`'s own `SelfAnalysisLlmPayloadSchema`, the
 * single source of truth this schema mirrors field-for-field rather than re-declaring a second,
 * possibly-drifting copy). `optional()`, never required — `LearningService` calls `selfAnalyze`
 * BEST-EFFORT, strictly BEFORE `generateImprovementPlan`; when self-analysis is unavailable/
 * degraded, this field is simply omitted and `generateImprovementPlan` proceeds exactly as it did
 * before this phase (see that method's own doc for why self-analysis is an ENHANCEMENT, never a
 * new gate).
 */
const ImprovementPlanSelfAnalysisSchema = z.object({
  rootCauses: z.array(z.string()),
  patterns: z.string(),
  confidence: z.number(),
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
  /** AAOS Self-Improving, Phase SI-3 — real, optional root-cause context from a SEPARATE, PRIOR `LlmService.selfAnalyze` call over this SAME gap. See `ImprovementPlanSelfAnalysisSchema`'s own doc. */
  selfAnalysis: ImprovementPlanSelfAnalysisSchema.optional(),
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
/**
 * Exported (AAOS Self-Learning AI, Phase C) so `LearningDecisionService.approve` can re-validate
 * each stored `learning_proposals.improvements[]` JSONB item against the SAME real shape this
 * schema already enforces at Phase B write time, rather than re-declaring a second, possibly-
 * drifting copy — same "call the real thing, never reimplement it" discipline this whole effort
 * follows elsewhere (see `LearningModule`'s own doc).
 */
export const ImprovementItemSchema = z.object({
  agent: z.enum(["SAMANTHA", "CLARA"]),
  /**
   * `"LOGIC_UPDATE"` (AAOS Self-Improving, Phase SI-2) — real, additive 3rd member, the
   * `agent_logic`/`KNOWN_LOGIC_KEYS` sibling of `"CONFIG_UPDATE"`. For a `LOGIC_UPDATE` item,
   * `before`/`after` carry the current/proposed `agent_logic.definition` as JSON TEXT (never a
   * live object) — `LogicApplierService.applyLogicUpdate` is the real, safe JSON.parse + structural
   * validation boundary (see that class's own doc), never `eval`/`new Function`.
   */
  type: z.enum(["PROMPT_UPDATE", "CONFIG_UPDATE", "LOGIC_UPDATE"]),
  /** MUST be a real `prompt_key`/`config_key`/`logic_key` — validated server-side by `LlmService.generateImprovementPlan`, never trusted from the LLM alone (belt-and-braces, same discipline `selectTargeting`'s candidate-id intersection / `campaignStrategy`'s angle-membership check already establish). */
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
