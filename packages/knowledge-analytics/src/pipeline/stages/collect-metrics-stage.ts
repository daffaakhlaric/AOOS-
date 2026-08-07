import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/**
 * Stage 1 — Collect Metrics: gathers the currently-recorded sample summaries from all 11
 * analytics services, unmodified, as the raw input for the stages that follow.
 */
export class CollectMetricsStage implements PipelineStage {
  readonly name = "CollectMetrics";

  execute(context: PipelineContext): PipelineContext {
    const { analytics, trendSeries } = context;
    const collected = {
      usage: analytics.usage.summary(),
      search: analytics.search.summary(),
      retrieval: analytics.retrieval.summary(),
      query: analytics.query.summary(),
      embedding: analytics.embedding.summary(),
      graph: analytics.graph.summary(),
      quality: analytics.quality.summary(),
      performance: analytics.performance.summary(),
      trend: analytics.trend.summary(trendSeries.names),
      cost: analytics.cost.summary(),
      recommendation: analytics.recommendation.summary(),
    };
    return { ...context, collected };
  }
}
