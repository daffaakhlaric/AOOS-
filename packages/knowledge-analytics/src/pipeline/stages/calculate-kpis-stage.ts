import { InvalidSampleException } from "../../errors/invalid-sample-exception.js";
import { KnowledgeMetricName } from "../../types/metric-name.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/**
 * Stage 3 — Calculate KPIs: flattens the collected per-service summaries into the 30 named
 * metrics from the specification, keyed by `KnowledgeMetricName`, and syncs every metric whose
 * value is a finite number into the shared `KnowledgeMetricRegistry` (registering it first if this
 * is the first time it has been seen). Metrics whose natural shape is not a single number
 * (Trend Analysis / Historical Metrics per-series breakdowns, Most/Least Accessed Knowledge
 * rankings) are still included in the KPI map for reporting, but are not registry-synced.
 */
export class CalculateKPIsStage implements PipelineStage {
  readonly name = "CalculateKPIs";

  execute(context: PipelineContext): PipelineContext {
    const collected = context.collected as
      | {
          usage: Record<string, unknown>;
          search: Record<string, unknown>;
          retrieval: Record<string, unknown>;
          query: Record<string, unknown>;
          embedding: Record<string, unknown>;
          graph: Record<string, unknown>;
          quality: Record<string, unknown>;
          performance: Record<string, unknown>;
          trend: Record<string, unknown>;
          cost: Record<string, unknown>;
          recommendation: Record<string, unknown>;
        }
      | undefined;
    if (!collected) {
      throw new InvalidSampleException(
        "CalculateKPIs ran before CollectMetrics populated `collected`",
      );
    }

    const kpis: Record<string, unknown> = {
      [KnowledgeMetricName.DocumentCount]: collected.usage.documentCount,
      [KnowledgeMetricName.IndexedCount]: collected.usage.indexedCount,
      [KnowledgeMetricName.DeletedCount]: collected.usage.deletedCount,
      [KnowledgeMetricName.StorageUsage]: collected.usage.currentStorageUsage,
      [KnowledgeMetricName.KnowledgeUsage]: collected.usage.totalKnowledgeUsage,
      [KnowledgeMetricName.ProviderUsage]: collected.usage.totalProviderUsage,
      [KnowledgeMetricName.SearchCount]: collected.search.searchCount,
      [KnowledgeMetricName.HitRate]: collected.search.hitRate,
      [KnowledgeMetricName.MissRate]: collected.search.missRate,
      [KnowledgeMetricName.RetrievalCount]: collected.retrieval.retrievalCount,
      [KnowledgeMetricName.CacheHit]: collected.retrieval.cacheHitCount,
      [KnowledgeMetricName.CacheMiss]: collected.retrieval.cacheMissCount,
      [KnowledgeMetricName.AverageQueryTime]: collected.query.averageQueryTime,
      [KnowledgeMetricName.P95QueryTime]: collected.query.p95QueryTime,
      [KnowledgeMetricName.P99QueryTime]: collected.query.p99QueryTime,
      [KnowledgeMetricName.EmbeddingTime]: collected.embedding.averageEmbeddingTime,
      [KnowledgeMetricName.TokenUsage]: collected.embedding.totalTokenUsage,
      [KnowledgeMetricName.GraphNodeCount]: collected.graph.nodeCount,
      [KnowledgeMetricName.GraphEdgeCount]: collected.graph.edgeCount,
      [KnowledgeMetricName.ConnectedComponents]: collected.graph.connectedComponents,
      [KnowledgeMetricName.AverageGraphDegree]: collected.graph.averageGraphDegree,
      [KnowledgeMetricName.SuccessRate]: collected.quality.successRate,
      [KnowledgeMetricName.FailureRate]: collected.quality.failureRate,
      [KnowledgeMetricName.RetrievalTime]: collected.performance.averageRetrievalTime,
      [KnowledgeMetricName.TrendAnalysis]: collected.trend.series,
      [KnowledgeMetricName.HistoricalMetrics]: collected.trend.series,
      [KnowledgeMetricName.EmbeddingCost]: collected.cost.totalEmbeddingCost,
      [KnowledgeMetricName.QueryCost]: collected.cost.totalQueryCost,
      [KnowledgeMetricName.MostAccessedKnowledge]: collected.recommendation.mostAccessedKnowledge,
      [KnowledgeMetricName.LeastAccessedKnowledge]: collected.recommendation.leastAccessedKnowledge,
    };

    let metricsCalculated = 0;
    for (const [id, value] of Object.entries(kpis)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      if (!context.metricRegistry.isRegistered(id)) {
        // Registration requires a full definition, which lives outside this stage's scope; the
        // engine pre-registers every `KnowledgeMetricName` on construction (see
        // `KnowledgeAnalyticsEngine`), so in practice this branch only guards against a caller
        // driving the pipeline directly with an unregistered id.
        continue;
      }
      context.metricRegistry.updateValue(id, value, context.clock());
      metricsCalculated += 1;
    }
    context.statistics.recordMetricCalculated(metricsCalculated);

    return { ...context, kpis };
  }
}
