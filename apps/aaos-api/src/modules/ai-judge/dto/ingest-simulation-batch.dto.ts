import { z } from "zod";

/**
 * `POST /api/v1/ai-judge/simulation-batch` body — the real bridge from `apps/aaos-simulator`'s
 * `POST /api/simulate-all` into this app's Self-Improving pipeline (Self-Learning AI, bridge
 * phase). This is a genuinely SEPARATE shape from `dto/judge-agent-run.dto.ts`'s
 * `ClaraJudgeScoresSchema` (Clara's LIVE-run judge, `CLARA_JUDGE_SYSTEM_PROMPT`, closing-metadata
 * dimensions only: `outcome_completeness`/`commission_plausibility`/`closing_type_consistency`/
 * `trend_consistency`) — the real investigation confirmed those measure something completely
 * different from what `@aos/ai-judge` computes here (real per-CONVERSATION dimensions:
 * `naturalLanguage`/`qualification`/`objectionHandling`/`closingAttempt`/`handoffQuality`/
 * `responseLength`, each 0-10, from `packages/ai-judge/src/domain/entities/JudgementResult.ts`).
 * Never force-fit into the same field names — this schema keeps `@aos/ai-judge`'s own real key
 * vocabulary verbatim, so a `judge_results.scores` row written from this endpoint is honestly
 * distinguishable (by its own key set) from one written by `AiJudgeService.judgeRun`'s LLM path.
 *
 * NO NEW MIGRATION: `029_judge_results.sql`'s `scores`/`gaps`/`strengths` columns are already
 * free-shape `JSONB` — that table's own header doc says so explicitly ("one JSONB blob, never
 * split into individual columns, so a future dimension never needs a migration"). This schema's
 * distinct key names (`naturalLanguage` etc., vs. `outcome_completeness` etc.) are additive DATA,
 * not a schema change — verified directly against the migration before deciding no new one was
 * needed.
 *
 * `overallScore`/`avgOverallScore` are already on the SAME `[0, 100]` scale
 * `LearningService.onAgentRunJudged`'s `judged.scores["overall"]` gate expects
 * (`packages/ai-judge/src/domain/value-objects/OverallScore.ts`: `MIN = 0, MAX = 100`) — no
 * rescaling needed, confirmed directly against that value object's source before relying on it.
 */
const JudgementResultSummarySchema = z.object({
  personaId: z.string().min(1),
  personaDifficulty: z.string().min(1),
  grade: z.string().min(1),
  verdict: z.string().min(1),
  overallScore: z.number().min(0).max(100),
  naturalLanguage: z.number().min(0).max(10),
  qualification: z.number().min(0).max(10),
  objectionHandling: z.number().min(0).max(10),
  closingAttempt: z.number().min(0).max(10),
  handoffQuality: z.number().min(0).max(10),
  responseLength: z.number().min(0).max(10),
  highlights: z.array(z.string()).default([]),
  improvementSuggestions: z
    .array(
      z.object({
        dimension: z.string().min(1),
        priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
        suggestion: z.string().min(1),
      }),
    )
    .default([]),
});

export const IngestSimulationBatchBodySchema = z.object({
  judgedAt: z.string().min(1),
  totalPersonas: z.number().int().min(1),
  approvedCount: z.number().int().min(0),
  needsImprovementCount: z.number().int().min(0),
  failCount: z.number().int().min(0),
  overallVerdict: z.enum(["APPROVE", "NEEDS_IMPROVEMENT", "FAIL"]),
  avgOverallScore: z.number().min(0).max(100),
  weakestDimensions: z.array(
    z.object({ dimension: z.string().min(1), avgScore: z.number().min(0).max(10) }),
  ),
  topPriorities: z.array(z.string()),
  results: z.array(JudgementResultSummarySchema).min(1),
});

export type IngestSimulationBatchBodyDto = z.infer<typeof IngestSimulationBatchBodySchema>;
