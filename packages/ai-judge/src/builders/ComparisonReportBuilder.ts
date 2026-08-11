import type { ComparisonReport, DimensionDelta } from "../domain/entities/ComparisonReport.js";
import type { JudgementResult } from "../domain/entities/JudgementResult.js";
import { ALL_DIMENSION_NAMES, DimensionName } from "../domain/value-objects/DimensionName.js";
import { Verdict } from "../domain/value-objects/Verdict.js";

const VERDICT_RANK: Readonly<Record<Verdict, number>> = {
  [Verdict.FAIL]: 0,
  [Verdict.NEEDS_IMPROVEMENT]: 1,
  [Verdict.APPROVE]: 2,
};

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

/**
 * Assembles a `ComparisonReport` diffing two `JudgementResult`s for the same persona — e.g.
 * "Jessy before refinement" vs "Jessy after refinement" (spec leaves the exact shape to this
 * implementation; design documented in docs/AAOS-AI-JUDGE-REPORT.md "CompareVersions design").
 * Pure — no I/O, no randomness.
 */
export class ComparisonReportBuilder {
  static build(
    before: JudgementResult,
    after: JudgementResult,
    comparedAt: Date,
  ): ComparisonReport {
    const dimensionDeltas: DimensionDelta[] = ALL_DIMENSION_NAMES.map((dimension) => {
      const beforeValue = dimensionScoreOf(before, dimension);
      const afterValue = dimensionScoreOf(after, dimension);
      return { dimension, before: beforeValue, after: afterValue, delta: afterValue - beforeValue };
    });

    const improvedDimensions = dimensionDeltas.filter((d) => d.delta > 0).map((d) => d.dimension);
    const regressedDimensions = dimensionDeltas.filter((d) => d.delta < 0).map((d) => d.dimension);
    const unchangedDimensions = dimensionDeltas
      .filter((d) => d.delta === 0)
      .map((d) => d.dimension);

    const overallScoreDelta = after.overallScore.value - before.overallScore.value;
    const verdictRankDelta = VERDICT_RANK[after.verdict] - VERDICT_RANK[before.verdict];

    return {
      personaId: before.personaId,
      before,
      after,
      comparedAt,
      overallScoreDelta,
      gradeBefore: before.grade,
      gradeAfter: after.grade,
      verdictBefore: before.verdict,
      verdictAfter: after.verdict,
      verdictImproved: verdictRankDelta > 0,
      verdictRegressed: verdictRankDelta < 0,
      dimensionDeltas,
      improvedDimensions,
      regressedDimensions,
      unchangedDimensions,
      summary: ComparisonReportBuilder.summarize(
        overallScoreDelta,
        improvedDimensions.length,
        regressedDimensions.length,
      ),
    };
  }

  private static summarize(
    overallScoreDelta: number,
    improvedCount: number,
    regressedCount: number,
  ): string {
    const direction = overallScoreDelta > 0 ? "naik" : overallScoreDelta < 0 ? "turun" : "tetap";
    return `Skor keseluruhan ${direction} ${Math.abs(overallScoreDelta).toFixed(1)} poin (${improvedCount} dimensi membaik, ${regressedCount} dimensi memburuk).`;
  }
}
