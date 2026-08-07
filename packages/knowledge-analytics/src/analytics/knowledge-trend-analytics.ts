import { KnowledgeMetricName } from "../types/metric-name.js";
import {
  bucketByInterval,
  calculatePeriodOverPeriodDelta,
  calculateTrendSlope,
  type TimeBucket,
} from "../utils/time-bucket.js";

import {
  BaseKnowledgeAnalyticsService,
  type BaseKnowledgeAnalyticsServiceOptions,
} from "./base-knowledge-analytics-service.js";

/** Constructor dependencies for {@link KnowledgeTrendAnalytics}. */
export interface KnowledgeTrendAnalyticsOptions extends BaseKnowledgeAnalyticsServiceOptions {
  /** Bucket width (ms) used when grouping historical samples for trend computation. Default 1h. */
  readonly bucketSizeMs?: number;
}

/**
 * Owns: Trend Analysis, Historical Metrics.
 *
 * Trend computation method: samples recorded for a named series are grouped into fixed-width time
 * buckets (`bucketSizeMs`, default one hour), each bucket's average is taken, and the trend is
 * reported two ways — a linear-regression slope across bucket averages (`trendSlope`) and a
 * period-over-period percentage delta between the last two buckets (`periodOverPeriodDelta`).
 * "Historical Metrics" is the bucketed history itself (`historicalMetrics`).
 */
export class KnowledgeTrendAnalytics extends BaseKnowledgeAnalyticsService {
  private readonly bucketSizeMs: number;

  constructor(options: KnowledgeTrendAnalyticsOptions = {}) {
    super(options);
    this.bucketSizeMs = options.bucketSizeMs ?? 3_600_000;
  }

  /** Records one historical data point for a named series (e.g. "search_count", "storage_usage"). */
  recordHistoricalValue(seriesName: string, value: number): void {
    this.record(`series:${seriesName}`, value);
    this.publish(KnowledgeMetricName.HistoricalMetrics, this.seriesCount(seriesName));
  }

  seriesCount(seriesName: string): number {
    return this.valuesFor(`series:${seriesName}`).length;
  }

  /** Bucketed history for `seriesName` (the "Historical Metrics" data). */
  historicalMetrics(seriesName: string): readonly TimeBucket[] {
    const samples = this.samplesFor(`series:${seriesName}`).map((sample) => ({
      timestamp: sample.timestamp,
      value: sample.value,
    }));
    return bucketByInterval(samples, this.bucketSizeMs);
  }

  /** Linear-regression slope of `seriesName`'s bucketed averages (the "Trend Analysis" metric). */
  trendSlope(seriesName: string): number {
    const slope = calculateTrendSlope(this.historicalMetrics(seriesName));
    this.publish(KnowledgeMetricName.TrendAnalysis, slope);
    return slope;
  }

  /** Period-over-period ratio delta between the last two buckets of `seriesName`. */
  periodOverPeriodDelta(seriesName: string): number {
    return calculatePeriodOverPeriodDelta(this.historicalMetrics(seriesName));
  }

  summary(seriesNames: readonly string[] = []): Readonly<Record<string, unknown>> {
    const series: Record<string, unknown> = {};
    for (const seriesName of seriesNames) {
      series[seriesName] = {
        seriesCount: this.seriesCount(seriesName),
        trendSlope: this.trendSlope(seriesName),
        periodOverPeriodDelta: this.periodOverPeriodDelta(seriesName),
      };
    }
    return { series };
  }
}
