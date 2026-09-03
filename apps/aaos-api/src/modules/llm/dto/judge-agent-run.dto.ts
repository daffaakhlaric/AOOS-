import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * `LlmService.judgeAgentRun` request context (AAOS-AI-JUDGE-SELF-IMPROVING, Phase J2). Composed
 * server-side by `AiJudgeService.judgeRun` from REAL data only — never accepted raw from an HTTP
 * caller (this method has no HTTP endpoint of its own, same "in-process only" precedent
 * `LlmService.selectTargeting`/`generateImprovementPlan` already establish for a method whose input
 * must be assembled server-side).
 *
 * `context` is deliberately `z.record(z.string(), z.unknown())`, NOT a per-agent-typed shape —
 * it's a direct pass-through of the real `agent_runs.context` JSONB column
 * (`AgentRunRepository.findById`'s result), whose real per-agent shape is documented (and can
 * drift slightly) at each of `AgentRunsService.record`'s 3 real call sites
 * (`scheduler.service.ts`/`creative-packages.service.ts`/`closings.service.ts`) — this DTO doesn't
 * re-declare a second, possibly-drifting copy of those 3 shapes. The per-agent judge SYSTEM PROMPT
 * (not this schema) is what tells the model exactly which real keys to expect for `context`, per
 * agent.
 */
const JudgeMemoryEntrySchema = z.object({
  createdAt: z.string(),
  /** Real `judge_results.scores.overall` from a PRIOR judgment — never fabricated. */
  overall: z.number(),
});

/**
 * AAOS Self-Improving, Phase SI-5 — real, additive "Judge Memory" enrichment
 * (`modules/judge-memory/judge-memory.service.ts`'s own class doc has the full reasoning). One real
 * `learning_proposals` row that genuinely had SOMETHING applied to production for this tenant+agent
 * (`status IN ('APPROVED','AUTO_APPLIED')`, or a mixed row with a non-empty
 * `auto_applied_config_keys`), plus the REAL judge-score trend around it — computed ONLY from the
 * SAME `recent` (up to 10) `judge_results` rows above, partitioned by this proposal's own
 * `created_at` (never a separate query, never a fabricated trend). `scoreBefore`/`scoreAfter` are
 * `null` (never `0`) when that side of the partition has zero real rows within the 10-row window —
 * an honest "not enough data on this side", not "no change".
 */
const JudgeMemoryAppliedProposalSchema = z.object({
  createdAt: z.string(),
  /** Real `config_key`/`logic_key`/`prompt_key` targets this proposal actually applied — `learning_proposals.auto_applied_config_keys` plus, for a human-`APPROVED` row, the real `PROMPT_UPDATE` targets from `improvements[]` (see `JudgeMemoryService`'s own doc). Never fabricated — a target only appears here when a real write actually happened. */
  appliedTargets: z.array(z.string()),
  scoreBefore: z.number().nullable(),
  scoreAfter: z.number().nullable(),
  /** `"UNKNOWN"` (never a guessed direction) when either side of the partition is `null`. */
  trend: z.enum(["IMPROVED", "DECLINED", "UNCHANGED", "UNKNOWN"]),
});

const JudgeMemorySchema = z.object({
  /** The tenant+agent's last (up to) 10 real `judge_results` rows, oldest-first — see `JudgeResultRepository.listRecentForTenant`. Empty when this is the tenant's first judged run for this agent. */
  recent: z.array(JudgeMemoryEntrySchema),
  /** Real, honestly-computed average of `recent[].overall` — `null` (never `0` or a fabricated number) when `recent` is empty. */
  averageOverall: z.number().nullable(),
  /**
   * AAOS Self-Improving, Phase SI-5 — real, curated "what got applied, and did scores move" memory,
   * `JudgeMemoryService.build`'s own real output. `.optional()` (never defaulted to `[]` by this
   * schema itself) so every EXISTING hand-built `JudgeMemory` object in this codebase's specs/fixtures
   * keeps type-checking unchanged; every real production call site (`AiJudgeService.judgeRun`,
   * `SandboxService`) always supplies a real (possibly empty) array — never `undefined` — so
   * `undefined` here only ever means "this particular caller predates Phase SI-5 / a test fixture",
   * never a real degrade state.
   */
  appliedProposals: z.array(JudgeMemoryAppliedProposalSchema).optional(),
  /**
   * AAOS Self-Improving, Phase SI-5 — real, deduplicated `learning_proposals.self_analysis.patterns`
   * text from this tenant+agent's own recent REAL applied proposals (never invented) — capped and
   * truncated by `JudgeMemoryService.build`. `[]` (never a fabricated "known good" list) when no
   * applied proposal has real self-analysis on it yet. Same `.optional()` reasoning as
   * `appliedProposals` above.
   */
  knownPatterns: z.array(z.string()).optional(),
});
export type JudgeMemory = z.infer<typeof JudgeMemorySchema>;

export const JudgeAgentRunRequestSchema = z.object({
  tenantId: z.string().min(1),
  agent: z.enum(["SAMANTHA", "KAI", "CLARA"]),
  /** The real `agent_runs.run_ref` this judgment concerns (a `calendar_events.id`/`creative_packages.id`/`leads.id` — see `028_agent_runs.sql`'s header doc). Included so the judge prompt/notes can reference it; never dereferenced by this method itself. */
  runRef: z.string().min(1),
  runCreatedAt: z.string(),
  context: z.record(z.string(), z.unknown()),
  memory: JudgeMemorySchema,
});
export type JudgeAgentRunRequestDto = z.infer<typeof JudgeAgentRunRequestSchema>;

/** Shared gap-item shape across all 3 agents' judge responses — same real fields the pasted EYVRA spec's own "BAGIAN 1: AI JUDGE" `gaps[]` shape uses. */
const JudgeGapSchema = z.object({
  dimension: z.string().min(1),
  score: z.number().min(0).max(100),
  issue: z.string().min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  suggestion: z.string().min(1),
});
export type JudgeGap = z.infer<typeof JudgeGapSchema>;

const JudgeTrendSchema = z.enum(["IMPROVING", "STABLE", "DECLINING"]);

/**
 * Real per-agent dimension score schemas (AAOS-AI-JUDGE-SELF-IMPROVING, Phase J2) — deliberately 3
 * SEPARATE schemas, not one generic `Record<string, number>` shared across agents, because the
 * pasted spec's own dimension lists genuinely differ per agent (`docs/PROMPT-EYVRA-SELF-IMPROVING-
 * AGENTIC-SYSTEM.md`, "BAGIAN 1"). Every dimension below was corrected against what
 * `AgentRunsService.record`'s REAL context shape actually contains for that agent (verified
 * directly against `scheduler.service.ts`/`creative-packages.service.ts`/`closings.service.ts`'s
 * real call sites, Phase J1) — see `LlmService`'s own judge-prompt constants for the field-by-field
 * corrections from the spec's assumed-but-nonexistent fields (e.g. Samantha's real context has no
 * "anomali terdeteksi"/"benchmark digunakan"; Kai's has no raw prompt/copy text to judge
 * "PROMPT_QUALITY"/"COPY_EFFECTIVENESS" against; Clara's real context here is a CLOSING OUTCOME
 * summary, not a conversation transcript, so "CONVERSATION_FLOW"/"OBJECTION_HANDLING" have no real
 * data to judge either).
 */
const SamanthaJudgeScoresSchema = z.object({
  /** Was the real LLM analysis path actually available for this run, vs. degraded to the rule-based-only PAUSE/SCALE aggregate (`context.aiAvailable`)? */
  ai_availability: z.number().min(0).max(100),
  /** How much of the tenant's real ad account was actually covered by this run (`context.campaigns`/`context.totalAds`) — a near-zero run on a tenant with real spend is a coverage gap. */
  coverage: z.number().min(0).max(100),
  /** Do the real `context.pause`/`context.scale` counts look like a genuine, actionable verdict distribution relative to `context.totalAds` — not fabricated reasoning quality (unavailable), just whether the counts are honestly informative. */
  verdict_actionability: z.number().min(0).max(100),
  /** How this run compares to the tenant's real recent judge history (`memory`) — stable, improving, or declining. */
  trend_consistency: z.number().min(0).max(100),
  overall: z.number().min(0).max(100),
});

const KaiJudgeScoresSchema = z.object({
  /** Did this generation actually complete (`context.status`), and — if not — is `context.errorMessage` a real, specific reason rather than a silent failure? */
  generation_success: z.number().min(0).max(100),
  /** Did the decided output format (`context.decidedFormat`) honor the requested one (`context.requestedFormat`), and — if it deviated — is that deviation plausible given `context.confidenceScore`? */
  format_decision_quality: z.number().min(0).max(100),
  /** Does `context.copyVariantCount` represent a genuine, useful spread of copy variants (e.g. enough for a real A/B comparison) rather than a shallow single-variant generation? */
  copy_variant_breadth: z.number().min(0).max(100),
  /** Does the real `context.aiModel`/`context.confidenceScore` the pipeline itself reported reflect a confident, real generation? */
  model_confidence: z.number().min(0).max(100),
  overall: z.number().min(0).max(100),
});

const ClaraJudgeScoresSchema = z.object({
  /** Is the real closing record itself complete (`context.closingType`/`context.branchId`/`context.unitModel`) — a thin record here is an honest completeness gap, not a conversation-quality judgment this context can't support. */
  outcome_completeness: z.number().min(0).max(100),
  /** Are `context.commissionIdr`/`context.commissionPct` present and internally plausible (e.g. roughly consistent with each other when both are given) — never a fabricated "is this the right amount" judgment this context has no price data to support. */
  commission_plausibility: z.number().min(0).max(100),
  /** Is `context.closingType` a real, recognizable closing type, consistently paired with a real `context.branchId`? */
  closing_type_consistency: z.number().min(0).max(100),
  /** How this run compares to the tenant's real recent judge history (`memory`) — stable, improving, or declining. */
  trend_consistency: z.number().min(0).max(100),
  overall: z.number().min(0).max(100),
});

function judgeLlmPayloadSchema<TScores extends z.ZodTypeAny>(scores: TScores) {
  return z.object({
    scores,
    strengths: z.array(z.string().min(1)),
    gaps: z.array(JudgeGapSchema),
    trend: JudgeTrendSchema,
    notes: z.string().min(1),
  });
}

export const SamanthaJudgeLlmPayloadSchema = judgeLlmPayloadSchema(SamanthaJudgeScoresSchema);
export const KaiJudgeLlmPayloadSchema = judgeLlmPayloadSchema(KaiJudgeScoresSchema);
export const ClaraJudgeLlmPayloadSchema = judgeLlmPayloadSchema(ClaraJudgeScoresSchema);

export type SamanthaJudgeLlmPayload = z.infer<typeof SamanthaJudgeLlmPayloadSchema>;
export type KaiJudgeLlmPayload = z.infer<typeof KaiJudgeLlmPayloadSchema>;
export type ClaraJudgeLlmPayload = z.infer<typeof ClaraJudgeLlmPayloadSchema>;

export type JudgeAgentRunResponseDto =
  | ({ readonly available: true; readonly agent: "SAMANTHA" } & SamanthaJudgeLlmPayload)
  | ({ readonly available: true; readonly agent: "KAI" } & KaiJudgeLlmPayload)
  | ({ readonly available: true; readonly agent: "CLARA" } & ClaraJudgeLlmPayload)
  | LlmUnavailableResponseDto;
