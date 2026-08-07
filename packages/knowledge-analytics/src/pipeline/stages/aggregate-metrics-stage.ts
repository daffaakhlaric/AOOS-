import { InvalidSampleException } from "../../errors/invalid-sample-exception.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/**
 * Stage 2 — Aggregate Metrics: rolls the per-service sample counts up into overall totals, so
 * later stages (and reports) have a package-wide view alongside the per-service detail.
 */
export class AggregateMetricsStage implements PipelineStage {
  readonly name = "AggregateMetrics";

  execute(context: PipelineContext): PipelineContext {
    if (!context.collected) {
      throw new InvalidSampleException(
        "AggregateMetrics ran before CollectMetrics populated `collected`",
      );
    }
    const { analytics } = context;
    const categorySampleCounts: Record<string, number> = {
      usage: analytics.usage.sampleCount(),
      search: analytics.search.sampleCount(),
      retrieval: analytics.retrieval.sampleCount(),
      query: analytics.query.sampleCount(),
      embedding: analytics.embedding.sampleCount(),
      graph: analytics.graph.sampleCount(),
      quality: analytics.quality.sampleCount(),
      performance: analytics.performance.sampleCount(),
      trend: analytics.trend.sampleCount(),
      cost: analytics.cost.sampleCount(),
      recommendation: analytics.recommendation.sampleCount(),
    };
    const totalSamples = Object.values(categorySampleCounts).reduce(
      (total, count) => total + count,
      0,
    );

    return {
      ...context,
      aggregated: { totalSamples, categorySampleCounts },
    };
  }
}
