import { KnowledgeCostAnalytics } from "../analytics/knowledge-cost-analytics.js";
import { KnowledgeEmbeddingAnalytics } from "../analytics/knowledge-embedding-analytics.js";
import { KnowledgeGraphAnalytics } from "../analytics/knowledge-graph-analytics.js";
import { KnowledgePerformanceAnalytics } from "../analytics/knowledge-performance-analytics.js";
import { KnowledgeQualityAnalytics } from "../analytics/knowledge-quality-analytics.js";
import { KnowledgeQueryAnalytics } from "../analytics/knowledge-query-analytics.js";
import { KnowledgeRecommendationAnalytics } from "../analytics/knowledge-recommendation-analytics.js";
import { KnowledgeRetrievalAnalytics } from "../analytics/knowledge-retrieval-analytics.js";
import { KnowledgeSearchAnalytics } from "../analytics/knowledge-search-analytics.js";
import { KnowledgeTrendAnalytics } from "../analytics/knowledge-trend-analytics.js";
import { KnowledgeUsageAnalytics } from "../analytics/knowledge-usage-analytics.js";
import { KnowledgeAnalyticsReportBuilder } from "../builders/knowledge-analytics-report-builder.js";
import type { IExternalMetricsSink } from "../contracts/i-external-metrics-sink.js";
import type { IKnowledgeAnalyticsEventPublisher } from "../contracts/i-knowledge-analytics-event-publisher.js";
import type { IKnowledgeAnalyticsModule } from "../contracts/i-knowledge-analytics-module.js";
import { KnowledgeAnalyticsSummary } from "../entities/knowledge-analytics-summary.js";
import { ReportNotFoundException } from "../errors/report-not-found-exception.js";
import { InMemoryEventPublisher } from "../events/in-memory-event-publisher.js";
import { KnowledgeMetricCalculator } from "../metrics/knowledge-metric-calculator.js";
import { KnowledgeMetricRegistry } from "../metrics/knowledge-metric-registry.js";
import { KnowledgeAnalyticsPipeline } from "../pipeline/knowledge-analytics-pipeline.js";
import type { PipelineContext } from "../pipeline/pipeline-stage.js";
import { KnowledgeReportRegistry } from "../registry/knowledge-report-registry.js";
import type { KnowledgeAnalyticsReport } from "../reports/knowledge-analytics-report.js";
import type { KnowledgeDashboardSnapshot } from "../reports/knowledge-dashboard-snapshot.js";
import type { Clock } from "../types/common.js";
import { KnowledgeMetricUnit } from "../types/common.js";
import { KnowledgeMetricCategory } from "../types/metric-category.js";
import { KnowledgeMetricName } from "../types/metric-name.js";
import { systemClock } from "../utils/clock.js";
import { generateId } from "../utils/id-generator.js";
import { KnowledgeAnalyticsConfiguration } from "../value-objects/knowledge-analytics-configuration.js";
import { KnowledgeMetricDefinition } from "../value-objects/knowledge-metric-definition.js";

import { KnowledgeAnalyticsStatistics } from "./knowledge-analytics-statistics.js";

/** The full metric catalog registered on every engine at construction time. */
const METRIC_CATALOG: readonly {
  id: KnowledgeMetricName;
  category: KnowledgeMetricCategory;
  unit: KnowledgeMetricUnit;
  description: string;
}[] = [
  {
    id: KnowledgeMetricName.DocumentCount,
    category: KnowledgeMetricCategory.Usage,
    unit: KnowledgeMetricUnit.Count,
    description: "Total documents recorded.",
  },
  {
    id: KnowledgeMetricName.IndexedCount,
    category: KnowledgeMetricCategory.Usage,
    unit: KnowledgeMetricUnit.Count,
    description: "Total documents indexed.",
  },
  {
    id: KnowledgeMetricName.DeletedCount,
    category: KnowledgeMetricCategory.Usage,
    unit: KnowledgeMetricUnit.Count,
    description: "Total documents deleted.",
  },
  {
    id: KnowledgeMetricName.StorageUsage,
    category: KnowledgeMetricCategory.Usage,
    unit: KnowledgeMetricUnit.Bytes,
    description: "Most recent storage usage reading.",
  },
  {
    id: KnowledgeMetricName.KnowledgeUsage,
    category: KnowledgeMetricCategory.Usage,
    unit: KnowledgeMetricUnit.Count,
    description: "Total knowledge item usage.",
  },
  {
    id: KnowledgeMetricName.ProviderUsage,
    category: KnowledgeMetricCategory.Usage,
    unit: KnowledgeMetricUnit.Count,
    description: "Total provider usage.",
  },
  {
    id: KnowledgeMetricName.SearchCount,
    category: KnowledgeMetricCategory.Search,
    unit: KnowledgeMetricUnit.Count,
    description: "Total searches performed.",
  },
  {
    id: KnowledgeMetricName.HitRate,
    category: KnowledgeMetricCategory.Search,
    unit: KnowledgeMetricUnit.Ratio,
    description: "Search hit rate.",
  },
  {
    id: KnowledgeMetricName.MissRate,
    category: KnowledgeMetricCategory.Search,
    unit: KnowledgeMetricUnit.Ratio,
    description: "Search miss rate.",
  },
  {
    id: KnowledgeMetricName.RetrievalCount,
    category: KnowledgeMetricCategory.Retrieval,
    unit: KnowledgeMetricUnit.Count,
    description: "Total retrievals performed.",
  },
  {
    id: KnowledgeMetricName.CacheHit,
    category: KnowledgeMetricCategory.Retrieval,
    unit: KnowledgeMetricUnit.Count,
    description: "Total cache hits.",
  },
  {
    id: KnowledgeMetricName.CacheMiss,
    category: KnowledgeMetricCategory.Retrieval,
    unit: KnowledgeMetricUnit.Count,
    description: "Total cache misses.",
  },
  {
    id: KnowledgeMetricName.AverageQueryTime,
    category: KnowledgeMetricCategory.Query,
    unit: KnowledgeMetricUnit.Milliseconds,
    description: "Average query time.",
  },
  {
    id: KnowledgeMetricName.P95QueryTime,
    category: KnowledgeMetricCategory.Query,
    unit: KnowledgeMetricUnit.Milliseconds,
    description: "P95 query time.",
  },
  {
    id: KnowledgeMetricName.P99QueryTime,
    category: KnowledgeMetricCategory.Query,
    unit: KnowledgeMetricUnit.Milliseconds,
    description: "P99 query time.",
  },
  {
    id: KnowledgeMetricName.EmbeddingTime,
    category: KnowledgeMetricCategory.Embedding,
    unit: KnowledgeMetricUnit.Milliseconds,
    description: "Average embedding time.",
  },
  {
    id: KnowledgeMetricName.TokenUsage,
    category: KnowledgeMetricCategory.Embedding,
    unit: KnowledgeMetricUnit.Tokens,
    description: "Total token usage.",
  },
  {
    id: KnowledgeMetricName.GraphNodeCount,
    category: KnowledgeMetricCategory.Graph,
    unit: KnowledgeMetricUnit.Count,
    description: "Latest graph node count.",
  },
  {
    id: KnowledgeMetricName.GraphEdgeCount,
    category: KnowledgeMetricCategory.Graph,
    unit: KnowledgeMetricUnit.Count,
    description: "Latest graph edge count.",
  },
  {
    id: KnowledgeMetricName.ConnectedComponents,
    category: KnowledgeMetricCategory.Graph,
    unit: KnowledgeMetricUnit.Count,
    description: "Latest connected components count.",
  },
  {
    id: KnowledgeMetricName.AverageGraphDegree,
    category: KnowledgeMetricCategory.Graph,
    unit: KnowledgeMetricUnit.Degree,
    description: "Average graph degree.",
  },
  {
    id: KnowledgeMetricName.SuccessRate,
    category: KnowledgeMetricCategory.Quality,
    unit: KnowledgeMetricUnit.Ratio,
    description: "Quality check success rate.",
  },
  {
    id: KnowledgeMetricName.FailureRate,
    category: KnowledgeMetricCategory.Quality,
    unit: KnowledgeMetricUnit.Ratio,
    description: "Quality check failure rate.",
  },
  {
    id: KnowledgeMetricName.RetrievalTime,
    category: KnowledgeMetricCategory.Performance,
    unit: KnowledgeMetricUnit.Milliseconds,
    description: "Average retrieval time.",
  },
  {
    id: KnowledgeMetricName.TrendAnalysis,
    category: KnowledgeMetricCategory.Trend,
    unit: KnowledgeMetricUnit.Score,
    description: "Per-series trend slope/delta breakdown.",
  },
  {
    id: KnowledgeMetricName.HistoricalMetrics,
    category: KnowledgeMetricCategory.Trend,
    unit: KnowledgeMetricUnit.Score,
    description: "Per-series bucketed history.",
  },
  {
    id: KnowledgeMetricName.EmbeddingCost,
    category: KnowledgeMetricCategory.Cost,
    unit: KnowledgeMetricUnit.Currency,
    description: "Total embedding cost.",
  },
  {
    id: KnowledgeMetricName.QueryCost,
    category: KnowledgeMetricCategory.Cost,
    unit: KnowledgeMetricUnit.Currency,
    description: "Total query cost.",
  },
  {
    id: KnowledgeMetricName.MostAccessedKnowledge,
    category: KnowledgeMetricCategory.Recommendation,
    unit: KnowledgeMetricUnit.Score,
    description: "Most accessed knowledge ranking.",
  },
  {
    id: KnowledgeMetricName.LeastAccessedKnowledge,
    category: KnowledgeMetricCategory.Recommendation,
    unit: KnowledgeMetricUnit.Score,
    description: "Least accessed knowledge ranking.",
  },
];

/** Constructor dependencies for {@link KnowledgeAnalyticsEngine}. */
export interface KnowledgeAnalyticsEngineOptions {
  readonly id?: string;
  readonly clock?: Clock;
  readonly configuration?: KnowledgeAnalyticsConfiguration;
  readonly eventPublisher?: IKnowledgeAnalyticsEventPublisher;
  readonly externalMetricsSink?: IExternalMetricsSink;
  readonly pipeline?: KnowledgeAnalyticsPipeline;
}

/**
 * Top-level facade/orchestrator composing all 11 analytics services, the metric registry, the
 * report registry/builder, the pipeline, and this package's own operational statistics. This is
 * the primary integration surface for a host application.
 */
export class KnowledgeAnalyticsEngine implements IKnowledgeAnalyticsModule {
  readonly id: string;

  readonly usage: KnowledgeUsageAnalytics;
  readonly search: KnowledgeSearchAnalytics;
  readonly retrieval: KnowledgeRetrievalAnalytics;
  readonly query: KnowledgeQueryAnalytics;
  readonly embedding: KnowledgeEmbeddingAnalytics;
  readonly graph: KnowledgeGraphAnalytics;
  readonly quality: KnowledgeQualityAnalytics;
  readonly performance: KnowledgePerformanceAnalytics;
  readonly trend: KnowledgeTrendAnalytics;
  readonly cost: KnowledgeCostAnalytics;
  readonly recommendation: KnowledgeRecommendationAnalytics;

  readonly metricRegistry: KnowledgeMetricRegistry;
  readonly reportRegistry: KnowledgeReportRegistry;
  readonly configuration: KnowledgeAnalyticsConfiguration;
  readonly statistics: KnowledgeAnalyticsStatistics;

  private readonly clock: Clock;
  private readonly calculator: KnowledgeMetricCalculator;
  private readonly reportBuilder: KnowledgeAnalyticsReportBuilder;
  private readonly eventPublisher: IKnowledgeAnalyticsEventPublisher;
  private readonly externalMetricsSink?: IExternalMetricsSink;
  private readonly pipeline: KnowledgeAnalyticsPipeline;
  private readonly trendSeriesNames = new Set<string>();
  private latestDashboardSnapshot: KnowledgeDashboardSnapshot | undefined;
  private started = false;

  constructor(options: KnowledgeAnalyticsEngineOptions = {}) {
    this.id = options.id ?? generateId("knowledge-analytics-engine");
    this.clock = options.clock ?? systemClock;
    this.configuration = options.configuration ?? new KnowledgeAnalyticsConfiguration();
    this.eventPublisher = options.eventPublisher ?? new InMemoryEventPublisher(this.clock);
    this.externalMetricsSink = options.externalMetricsSink;
    this.calculator = new KnowledgeMetricCalculator();
    this.metricRegistry = new KnowledgeMetricRegistry();
    this.reportRegistry = new KnowledgeReportRegistry();
    this.reportBuilder = new KnowledgeAnalyticsReportBuilder();
    this.statistics = new KnowledgeAnalyticsStatistics();
    this.pipeline = options.pipeline ?? new KnowledgeAnalyticsPipeline();

    for (const entry of METRIC_CATALOG) {
      this.metricRegistry.register(
        new KnowledgeMetricDefinition({
          id: entry.id,
          name: entry.id,
          category: entry.category,
          unit: entry.unit,
          description: entry.description,
        }),
      );
    }

    const serviceOptions = {
      registry: this.metricRegistry,
      calculator: this.calculator,
      clock: this.clock,
      historyRetentionLimit: this.configuration.historyRetentionLimit,
    };
    this.usage = new KnowledgeUsageAnalytics(serviceOptions);
    this.search = new KnowledgeSearchAnalytics(serviceOptions);
    this.retrieval = new KnowledgeRetrievalAnalytics(serviceOptions);
    this.query = new KnowledgeQueryAnalytics(serviceOptions);
    this.embedding = new KnowledgeEmbeddingAnalytics(serviceOptions);
    this.graph = new KnowledgeGraphAnalytics(serviceOptions);
    this.quality = new KnowledgeQualityAnalytics(serviceOptions);
    this.performance = new KnowledgePerformanceAnalytics(serviceOptions);
    this.trend = new KnowledgeTrendAnalytics({
      ...serviceOptions,
      bucketSizeMs: this.configuration.trendBucketSizeMs,
    });
    this.cost = new KnowledgeCostAnalytics(serviceOptions);
    this.recommendation = new KnowledgeRecommendationAnalytics(serviceOptions);
  }

  /** Registers a named series so `KnowledgeTrendAnalytics` includes it in every pipeline run. */
  trackTrendSeries(seriesName: string): void {
    this.trendSeriesNames.add(seriesName);
  }

  /** Forwards `sample` to the optional external metrics sink, if one was supplied. Never throws on a missing sink. */
  mirrorToExternalSink(sample: Parameters<IExternalMetricsSink["receive"]>[0]): void {
    this.externalMetricsSink?.receive(sample);
    this.statistics.recordSampleRecorded();
  }

  /** Runs the full 6-stage `KnowledgeAnalyticsPipeline` and returns the resulting context. */
  runPipeline(): PipelineContext {
    const result = this.pipeline.run({
      clock: this.clock,
      config: this.configuration,
      analytics: {
        usage: this.usage,
        search: this.search,
        retrieval: this.retrieval,
        query: this.query,
        embedding: this.embedding,
        graph: this.graph,
        quality: this.quality,
        performance: this.performance,
        trend: this.trend,
        cost: this.cost,
        recommendation: this.recommendation,
      },
      trendSeries: { names: [...this.trendSeriesNames] },
      calculator: this.calculator,
      metricRegistry: this.metricRegistry,
      reportRegistry: this.reportRegistry,
      reportBuilder: this.reportBuilder,
      statistics: this.statistics,
      eventPublisher: this.eventPublisher,
    });
    if (result.dashboardSnapshot) this.latestDashboardSnapshot = result.dashboardSnapshot;
    return result;
  }

  getReport(id: string): KnowledgeAnalyticsReport {
    return this.reportRegistry.get(id);
  }

  latestDashboard(): KnowledgeDashboardSnapshot {
    if (!this.latestDashboardSnapshot) {
      throw new ReportNotFoundException("dashboard-snapshot (no pipeline run has completed yet)");
    }
    return this.latestDashboardSnapshot;
  }

  summary(): KnowledgeAnalyticsSummary {
    const now = this.clock();
    const categoryTotals: Record<string, number> = {
      usage: this.usage.sampleCount(),
      search: this.search.sampleCount(),
      retrieval: this.retrieval.sampleCount(),
      query: this.query.sampleCount(),
      embedding: this.embedding.sampleCount(),
      graph: this.graph.sampleCount(),
      quality: this.quality.sampleCount(),
      performance: this.performance.sampleCount(),
      trend: this.trend.sampleCount(),
      cost: this.cost.sampleCount(),
      recommendation: this.recommendation.sampleCount(),
    };
    const statsSnapshot = this.statistics.snapshot(now);
    return new KnowledgeAnalyticsSummary({
      id: generateId("summary"),
      generatedAt: now,
      totalSamplesRecorded: Object.values(categoryTotals).reduce(
        (total, count) => total + count,
        0,
      ),
      totalReportsGenerated: statsSnapshot.reportsGenerated,
      totalMetricsTracked: this.metricRegistry.size(),
      categoryTotals,
    });
  }

  start(): void {
    this.started = true;
  }

  stop(): void {
    this.started = false;
  }

  isStarted(): boolean {
    return this.started;
  }
}
