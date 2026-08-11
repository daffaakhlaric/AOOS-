import { err, ok, type Result } from "@aos/common";
import type { SessionId, SimulationResult } from "@aos/conversation-simulator";

import type {
  AllScenariosReport,
  WeakestDimension,
} from "../../domain/entities/AllScenariosReport.js";
import type { JudgementResult } from "../../domain/entities/JudgementResult.js";
import type { JudgeError } from "../../domain/errors/JudgeError.js";
import { ALL_DIMENSION_NAMES, DimensionName } from "../../domain/value-objects/DimensionName.js";
import { verdictFromScore, Verdict } from "../../domain/value-objects/Verdict.js";

import type { JudgeConversation } from "./JudgeConversation.js";

function dimensionScoreOf(result: JudgementResult, dimension: DimensionName): number {
  switch (dimension) {
    case DimensionName.NATURAL_LANGUAGE:
      return result.naturalLanguage.score.value;
    case DimensionName.QUALIFICATION:
      return result.qualification.score.value;
    case DimensionName.OBJECTION_HANDLING:
      return result.objectionHandling.score.value;
    case DimensionName.CLOSING_ATTEMPT:
      return result.closingAttempt.score.value;
    case DimensionName.HANDOFF_QUALITY:
      return result.handoffQuality.score.value;
    case DimensionName.RESPONSE_LENGTH:
      return result.responseLength.score.value;
    /* v8 ignore next 2 -- ALL_DIMENSION_NAMES is exhaustive over DimensionName, so this default is unreachable. */
    default:
      return 0;
  }
}

const DIMENSION_LABELS: Readonly<Record<DimensionName, string>> = {
  [DimensionName.NATURAL_LANGUAGE]: "Natural Language",
  [DimensionName.QUALIFICATION]: "Qualification",
  [DimensionName.OBJECTION_HANDLING]: "Objection Handling",
  [DimensionName.CLOSING_ATTEMPT]: "Closing Attempt",
  [DimensionName.HANDOFF_QUALITY]: "Handoff Quality",
  [DimensionName.RESPONSE_LENGTH]: "Response Length",
};

const WEAK_DIMENSION_THRESHOLD = 7;

/** Judges every persona's `SimulationResult` at once, producing a workspace-wide report (spec "application/use-cases/JudgeAllScenarios.ts"). */
export class JudgeAllScenarios {
  constructor(private readonly judgeConversation: JudgeConversation) {}

  async execute(
    simulationResults: ReadonlyArray<SimulationResult>,
  ): Promise<Result<AllScenariosReport, JudgeError>> {
    const results: JudgementResult[] = [];
    for (const simulationResult of simulationResults) {
      const judged = await this.judgeConversation.execute(simulationResult);
      if (!judged.ok) {
        return err(judged.error);
      }
      results.push(judged.value);
    }

    const approvedCount = results.filter((r) => r.verdict === Verdict.APPROVE).length;
    const needsImprovementCount = results.filter(
      (r) => r.verdict === Verdict.NEEDS_IMPROVEMENT,
    ).length;
    const failCount = results.filter((r) => r.verdict === Verdict.FAIL).length;

    const avgOverallScore =
      results.length === 0
        ? 0
        : results.reduce((sum, r) => sum + r.overallScore.value, 0) / results.length;
    const overallVerdict = verdictFromScore(avgOverallScore);

    const weakestDimensions: WeakestDimension[] = ALL_DIMENSION_NAMES.map((dimension) => ({
      dimension,
      avgScore:
        results.length === 0
          ? 0
          : results.reduce((sum, r) => sum + dimensionScoreOf(r, dimension), 0) / results.length,
    })).sort((a, b) => a.avgScore - b.avgScore);

    const topPriorities = weakestDimensions
      .filter((w) => w.avgScore < WEAK_DIMENSION_THRESHOLD)
      .map(
        (w) =>
          `Perbaiki ${DIMENSION_LABELS[w.dimension as DimensionName]} — rata-rata skor ${w.avgScore.toFixed(1)}/10 di seluruh persona.`,
      );

    const goldenCandidates: SessionId[] = results
      .filter((r) => r.isGoldenCandidate)
      .map((r) => r.simulationSessionId);

    return ok({
      judgedAt: new Date(),
      totalPersonas: simulationResults.length,
      approvedCount,
      needsImprovementCount,
      failCount,
      overallVerdict,
      avgOverallScore,
      results,
      weakestDimensions,
      topPriorities,
      goldenCandidates,
    });
  }
}
