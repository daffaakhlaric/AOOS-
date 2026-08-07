import type { KnowledgeCostAnalytics } from "../analytics/knowledge-cost-analytics.js";
import type { KnowledgeEmbeddingAnalytics } from "../analytics/knowledge-embedding-analytics.js";
import type { KnowledgeGraphAnalytics } from "../analytics/knowledge-graph-analytics.js";
import type { KnowledgePerformanceAnalytics } from "../analytics/knowledge-performance-analytics.js";
import type { KnowledgeQualityAnalytics } from "../analytics/knowledge-quality-analytics.js";
import type { KnowledgeQueryAnalytics } from "../analytics/knowledge-query-analytics.js";
import type { KnowledgeRecommendationAnalytics } from "../analytics/knowledge-recommendation-analytics.js";
import type { KnowledgeRetrievalAnalytics } from "../analytics/knowledge-retrieval-analytics.js";
import type { KnowledgeSearchAnalytics } from "../analytics/knowledge-search-analytics.js";
import type { KnowledgeTrendAnalytics } from "../analytics/knowledge-trend-analytics.js";
import type { KnowledgeUsageAnalytics } from "../analytics/knowledge-usage-analytics.js";
import type { KnowledgeAnalyticsReportBuilder } from "../builders/knowledge-analytics-report-builder.js";
import type { IKnowledgeAnalyticsEventPublisher } from "../contracts/i-knowledge-analytics-event-publisher.js";
import type { KnowledgeMetricCalculator } from "../metrics/knowledge-metric-calculator.js";
import type { KnowledgeMetricRegistry } from "../metrics/knowledge-metric-registry.js";
import type { KnowledgeReportRegistry } from "../registry/knowledge-report-registry.js";
import type { KnowledgeAnalyticsReport } from "../reports/knowledge-analytics-report.js";
import type { KnowledgeDashboardSnapshot } from "../reports/knowledge-dashboard-snapshot.js";
import type { KnowledgeAnalyticsStatistics } from "../services/knowledge-analytics-statistics.js";
import type { Clock } from "../types/common.js";
import type { KnowledgeAnalyticsConfiguration } from "../value-objects/knowledge-analytics-configuration.js";

/** The 11 analytics services a pipeline run collects from, grouped for convenience. */
export interface PipelineAnalyticsServices {
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
}

/** Series names `KnowledgeTrendAnalytics` should summarize during a pipeline run. */
export interface PipelineTrendSeries {
  readonly names: readonly string[];
}

/**
 * The mutable working state threaded through the 6 pipeline stages. Each stage reads what prior
 * stages produced and writes its own output field; nothing here is a frozen domain model — it is
 * purely pipeline-run bookkeeping.
 */
export interface PipelineContext {
  readonly runId: string;
  readonly clock: Clock;
  readonly config: KnowledgeAnalyticsConfiguration;
  readonly analytics: PipelineAnalyticsServices;
  readonly trendSeries: PipelineTrendSeries;
  readonly calculator: KnowledgeMetricCalculator;
  readonly metricRegistry: KnowledgeMetricRegistry;
  readonly reportRegistry: KnowledgeReportRegistry;
  readonly reportBuilder: KnowledgeAnalyticsReportBuilder;
  readonly statistics: KnowledgeAnalyticsStatistics;
  readonly eventPublisher: IKnowledgeAnalyticsEventPublisher;

  /** Stage 1 output: raw per-service summaries collected as-is. */
  collected?: Readonly<Record<string, unknown>>;
  /** Stage 2 output: rollups derived from `collected` (totals across services). */
  aggregated?: Readonly<Record<string, unknown>>;
  /** Stage 3 output: the derived KPI map (rates/percentiles/averages), registry-synced. */
  kpis?: Readonly<Record<string, unknown>>;
  /** Stage 4 output: every report generated this run. */
  reports?: readonly KnowledgeAnalyticsReport[];
  /** Stage 5 output: the dashboard snapshot generated this run. */
  dashboardSnapshot?: KnowledgeDashboardSnapshot;
}

/** One stage of the `KnowledgeAnalyticsPipeline`. Mutates `context` in place and returns it. */
export interface PipelineStage {
  readonly name: string;
  execute(context: PipelineContext): PipelineContext;
}
