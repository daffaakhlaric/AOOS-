import type { HealthStatus } from "../../types/health-status.js";
import { evaluateThreshold } from "../../utils/scoring-math.js";
import { KnowledgeHealthScore } from "../../value-objects/knowledge-health-score.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 9: recommendation + health/readiness/insight generation over the analyzed corpus. */
export class GenerateRecommendationsStage implements PipelineStage {
  readonly name = "generate-recommendations";

  execute(context: PipelineContext): PipelineContext {
    context.recommendations = context.recommendationEngine.generate(context.items);

    const coverageValue = context.coverageScore?.value ?? 100;
    const itemScores = context.healthEngine.scoreCorpus(context.items, coverageValue);
    const averageOverall = context.healthEngine.averageOverall(context.items, coverageValue);

    const overall = new KnowledgeHealthScore({
      overall: averageOverall,
      quality: this.average(itemScores.map((s) => s.score.quality)),
      freshness: this.average(itemScores.map((s) => s.score.freshness)),
      coverage: coverageValue,
      risk: this.average(itemScores.map((s) => s.score.risk)),
      status: evaluateThreshold(averageOverall, context.config.healthBands) as HealthStatus,
    });

    context.healthReport = context.healthReportFactory.create(overall, itemScores);

    const staleCount = context.items.filter((item) => context.freshnessEngine.isStale(item)).length;
    context.insights = context.insightEngine.generate({
      totalItems: context.items.length,
      duplicatePairCount: context.duplicates?.length ?? 0,
      nearDuplicatePairCount: context.nearDuplicates?.length ?? 0,
      gapCount: context.gapReport?.gaps.length ?? 0,
      orphanCount: context.gapReport?.orphans.length ?? 0,
      staleItemCount: staleCount,
      averageHealthScore: averageOverall,
      duplicateItemIds: (context.duplicates ?? []).flatMap((d) => [d.itemAId, d.itemBId]),
      orphanItemIds: (context.gapReport?.orphans ?? []).map((o) => o.itemId),
    });

    return context;
  }

  private average(values: readonly number[]): number {
    if (values.length === 0) return 100;
    return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100;
  }
}
