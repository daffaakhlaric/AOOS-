import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsEngine } from "../../src/services/knowledge-analytics-engine.js";
import { KnowledgeMetricCategory } from "../../src/types/metric-category.js";
import { KnowledgeMetricName } from "../../src/types/metric-name.js";

/**
 * Verifies the exact metric-to-analytics-service distribution table documented in the Engineering
 * Report: every one of the 30 named metrics is registered under its documented owning category,
 * with no metric left unregistered (orphaned).
 */
const EXPECTED_CATEGORY: Readonly<Record<KnowledgeMetricName, KnowledgeMetricCategory>> = {
  [KnowledgeMetricName.DocumentCount]: KnowledgeMetricCategory.Usage,
  [KnowledgeMetricName.IndexedCount]: KnowledgeMetricCategory.Usage,
  [KnowledgeMetricName.DeletedCount]: KnowledgeMetricCategory.Usage,
  [KnowledgeMetricName.StorageUsage]: KnowledgeMetricCategory.Usage,
  [KnowledgeMetricName.KnowledgeUsage]: KnowledgeMetricCategory.Usage,
  [KnowledgeMetricName.ProviderUsage]: KnowledgeMetricCategory.Usage,
  [KnowledgeMetricName.SearchCount]: KnowledgeMetricCategory.Search,
  [KnowledgeMetricName.HitRate]: KnowledgeMetricCategory.Search,
  [KnowledgeMetricName.MissRate]: KnowledgeMetricCategory.Search,
  [KnowledgeMetricName.RetrievalCount]: KnowledgeMetricCategory.Retrieval,
  [KnowledgeMetricName.CacheHit]: KnowledgeMetricCategory.Retrieval,
  [KnowledgeMetricName.CacheMiss]: KnowledgeMetricCategory.Retrieval,
  [KnowledgeMetricName.AverageQueryTime]: KnowledgeMetricCategory.Query,
  [KnowledgeMetricName.P95QueryTime]: KnowledgeMetricCategory.Query,
  [KnowledgeMetricName.P99QueryTime]: KnowledgeMetricCategory.Query,
  [KnowledgeMetricName.EmbeddingTime]: KnowledgeMetricCategory.Embedding,
  [KnowledgeMetricName.TokenUsage]: KnowledgeMetricCategory.Embedding,
  [KnowledgeMetricName.GraphNodeCount]: KnowledgeMetricCategory.Graph,
  [KnowledgeMetricName.GraphEdgeCount]: KnowledgeMetricCategory.Graph,
  [KnowledgeMetricName.ConnectedComponents]: KnowledgeMetricCategory.Graph,
  [KnowledgeMetricName.AverageGraphDegree]: KnowledgeMetricCategory.Graph,
  [KnowledgeMetricName.SuccessRate]: KnowledgeMetricCategory.Quality,
  [KnowledgeMetricName.FailureRate]: KnowledgeMetricCategory.Quality,
  [KnowledgeMetricName.RetrievalTime]: KnowledgeMetricCategory.Performance,
  [KnowledgeMetricName.TrendAnalysis]: KnowledgeMetricCategory.Trend,
  [KnowledgeMetricName.HistoricalMetrics]: KnowledgeMetricCategory.Trend,
  [KnowledgeMetricName.EmbeddingCost]: KnowledgeMetricCategory.Cost,
  [KnowledgeMetricName.QueryCost]: KnowledgeMetricCategory.Cost,
  [KnowledgeMetricName.MostAccessedKnowledge]: KnowledgeMetricCategory.Recommendation,
  [KnowledgeMetricName.LeastAccessedKnowledge]: KnowledgeMetricCategory.Recommendation,
};

describe("Metric catalog distribution (30 metrics -> 11 analytics services)", () => {
  const engine = new KnowledgeAnalyticsEngine();

  it("registers exactly 30 metrics", () => {
    expect(engine.metricRegistry.size()).toBe(30);
  });

  it.each(Object.entries(EXPECTED_CATEGORY))(
    "metric %s is registered under its documented category",
    (id, expectedCategory) => {
      expect(engine.metricRegistry.get(id).definition.category).toBe(expectedCategory);
    },
  );

  it.each(Object.values(KnowledgeMetricName))(
    "metric %s is registered (no orphaned metric)",
    (id) => {
      expect(engine.metricRegistry.isRegistered(id)).toBe(true);
    },
  );

  it("every category from KnowledgeMetricCategory owns at least one metric", () => {
    const owned = new Set(Object.values(EXPECTED_CATEGORY));
    for (const category of Object.values(KnowledgeMetricCategory)) {
      expect(owned.has(category)).toBe(true);
    }
  });
});
