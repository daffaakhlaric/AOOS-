import { KnowledgeCostAnalytics } from "../../src/analytics/knowledge-cost-analytics.js";
import { KnowledgeEmbeddingAnalytics } from "../../src/analytics/knowledge-embedding-analytics.js";
import { KnowledgeGraphAnalytics } from "../../src/analytics/knowledge-graph-analytics.js";
import { KnowledgePerformanceAnalytics } from "../../src/analytics/knowledge-performance-analytics.js";
import { KnowledgeQualityAnalytics } from "../../src/analytics/knowledge-quality-analytics.js";
import { KnowledgeQueryAnalytics } from "../../src/analytics/knowledge-query-analytics.js";
import { KnowledgeRecommendationAnalytics } from "../../src/analytics/knowledge-recommendation-analytics.js";
import { KnowledgeRetrievalAnalytics } from "../../src/analytics/knowledge-retrieval-analytics.js";
import { KnowledgeSearchAnalytics } from "../../src/analytics/knowledge-search-analytics.js";
import { KnowledgeTrendAnalytics } from "../../src/analytics/knowledge-trend-analytics.js";
import { KnowledgeUsageAnalytics } from "../../src/analytics/knowledge-usage-analytics.js";
import { KnowledgeAnalyticsReportBuilder } from "../../src/builders/knowledge-analytics-report-builder.js";
import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeMetricCalculator } from "../../src/metrics/knowledge-metric-calculator.js";
import { KnowledgeMetricRegistry } from "../../src/metrics/knowledge-metric-registry.js";
import type { PipelineContext } from "../../src/pipeline/pipeline-stage.js";
import { KnowledgeReportRegistry } from "../../src/registry/knowledge-report-registry.js";
import { KnowledgeAnalyticsStatistics } from "../../src/services/knowledge-analytics-statistics.js";
import { KnowledgeMetricUnit } from "../../src/types/common.js";
import { KnowledgeMetricCategory } from "../../src/types/metric-category.js";
import { KnowledgeMetricName } from "../../src/types/metric-name.js";
import { createFixedClock } from "../../src/utils/clock.js";
import { KnowledgeAnalyticsConfiguration } from "../../src/value-objects/knowledge-analytics-configuration.js";
import { KnowledgeMetricDefinition } from "../../src/value-objects/knowledge-metric-definition.js";

import { FIXED_TIMESTAMP } from "./fixtures.js";

/** Builds a fresh `PipelineContext` (minus `runId`) with every dependency wired for stage-level testing. */
export function createPipelineContextFixture(
  overrides: Partial<Omit<PipelineContext, "runId">> = {},
): Omit<PipelineContext, "runId"> {
  const clock = createFixedClock(FIXED_TIMESTAMP);
  const metricRegistry = new KnowledgeMetricRegistry();
  for (const id of Object.values(KnowledgeMetricName)) {
    metricRegistry.register(
      new KnowledgeMetricDefinition({
        id,
        name: id,
        category: KnowledgeMetricCategory.Usage,
        unit: KnowledgeMetricUnit.Count,
        description: "fixture metric",
      }),
    );
  }

  const serviceOptions = { registry: metricRegistry, clock };

  return {
    clock,
    config: new KnowledgeAnalyticsConfiguration(),
    analytics: {
      usage: new KnowledgeUsageAnalytics(serviceOptions),
      search: new KnowledgeSearchAnalytics(serviceOptions),
      retrieval: new KnowledgeRetrievalAnalytics(serviceOptions),
      query: new KnowledgeQueryAnalytics(serviceOptions),
      embedding: new KnowledgeEmbeddingAnalytics(serviceOptions),
      graph: new KnowledgeGraphAnalytics(serviceOptions),
      quality: new KnowledgeQualityAnalytics(serviceOptions),
      performance: new KnowledgePerformanceAnalytics(serviceOptions),
      trend: new KnowledgeTrendAnalytics(serviceOptions),
      cost: new KnowledgeCostAnalytics(serviceOptions),
      recommendation: new KnowledgeRecommendationAnalytics(serviceOptions),
    },
    trendSeries: { names: [] },
    calculator: new KnowledgeMetricCalculator(),
    metricRegistry,
    reportRegistry: new KnowledgeReportRegistry(),
    reportBuilder: new KnowledgeAnalyticsReportBuilder(),
    statistics: new KnowledgeAnalyticsStatistics(),
    eventPublisher: new InMemoryEventPublisher(clock),
    ...overrides,
  };
}
