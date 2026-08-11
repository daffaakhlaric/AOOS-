import type { Result } from "@aos/common";
import {
  AiJudgeFactory,
  type AiJudge,
  type AllScenariosReport,
  type JudgeError,
  type JudgementResult,
} from "@aos/ai-judge";

import type {
  AllScenariosReportDto,
  DimensionScoreDto,
  JudgementResultDto,
} from "../types/simulator.types";

/**
 * Server-side composition of `@aos/ai-judge` (spec "lib/judge.ts": "init AiJudgeFactory").
 * `AiJudgeFactory.create()` is fully self-contained — it wires its own 6 dimension scorers,
 * `JudgementService`, and `GoldenDatasetRegistry` internally, no other `@aos/*` package required.
 *
 * Never imported into a `"use client"` component (design resolution #5) — only the two Route
 * Handlers under `src/app/api/**` call this.
 */
let cachedJudge: AiJudge | undefined;

export function getJudge(): Result<AiJudge, JudgeError> {
  if (cachedJudge) {
    return { ok: true, value: cachedJudge };
  }
  const created = AiJudgeFactory.create();
  if (created.ok) {
    cachedJudge = created.value;
  }
  return created;
}

function toDimensionScoreDto(score: {
  readonly dimension: string;
  readonly score: { readonly value: number };
  readonly appliedRules: ReadonlyArray<{
    readonly rule: string;
    readonly points: number;
    readonly note: string;
  }>;
}): DimensionScoreDto {
  return {
    dimension: score.dimension,
    score: score.score.value,
    appliedRules: score.appliedRules.map((r) => ({ ...r })),
  };
}

/**
 * Maps the real `JudgementResult` (whose `id`/`simulationSessionId`/`overallScore`/per-dimension
 * `score` fields are class-based value objects — see `simulator.types.ts`'s file-level doc) into a
 * plain, JSON-safe DTO.
 */
export function toJudgementResultDto(result: JudgementResult): JudgementResultDto {
  return {
    id: result.id.toString(),
    simulationSessionId: result.simulationSessionId.toString(),
    personaId: result.personaId,
    personaDifficulty: result.personaDifficulty,
    judgedAt: result.judgedAt.toISOString(),
    naturalLanguage: toDimensionScoreDto(result.naturalLanguage),
    qualification: toDimensionScoreDto(result.qualification),
    objectionHandling: toDimensionScoreDto(result.objectionHandling),
    closingAttempt: toDimensionScoreDto(result.closingAttempt),
    handoffQuality: toDimensionScoreDto(result.handoffQuality),
    responseLength: toDimensionScoreDto(result.responseLength),
    overallScore: result.overallScore.value,
    grade: result.grade,
    verdict: result.verdict,
    feedbackItems: result.feedbackItems.map((f) => ({ ...f })),
    improvementSuggestions: result.improvementSuggestions.map((s) => ({ ...s })),
    highlights: [...result.highlights],
    isGoldenCandidate: result.isGoldenCandidate,
  };
}

/** Maps the real `AllScenariosReport` into a plain, JSON-safe DTO. */
export function toAllScenariosReportDto(report: AllScenariosReport): AllScenariosReportDto {
  return {
    judgedAt: report.judgedAt.toISOString(),
    totalPersonas: report.totalPersonas,
    approvedCount: report.approvedCount,
    needsImprovementCount: report.needsImprovementCount,
    failCount: report.failCount,
    overallVerdict: report.overallVerdict,
    avgOverallScore: report.avgOverallScore,
    results: report.results.map(toJudgementResultDto),
    weakestDimensions: report.weakestDimensions.map((w) => ({ ...w })),
    topPriorities: [...report.topPriorities],
    goldenCandidates: report.goldenCandidates.map((id) => id.toString()),
  };
}
