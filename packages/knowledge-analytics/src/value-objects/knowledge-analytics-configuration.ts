import { InvalidSampleException } from "../errors/invalid-sample-exception.js";

/** Constructor properties for {@link KnowledgeAnalyticsConfiguration}. */
export interface KnowledgeAnalyticsConfigurationProps {
  /** Percentiles (0-100) the analytics services compute by default, e.g. `[95, 99]`. */
  readonly percentileThresholds?: readonly number[];
  /** Advisory metadata only — this package never schedules real timers itself (in-memory/standalone). */
  readonly dashboardRefreshCadenceMs?: number;
  /** Bucket width used by `KnowledgeTrendAnalytics` when grouping historical samples. */
  readonly trendBucketSizeMs?: number;
  /** Maximum number of samples retained per metric before the oldest are evicted (0 = unbounded). */
  readonly historyRetentionLimit?: number;
}

/**
 * Immutable configuration for a `KnowledgeAnalyticsEngine`. Every field has a sensible default so
 * `new KnowledgeAnalyticsConfiguration()` is always valid.
 */
export class KnowledgeAnalyticsConfiguration {
  public readonly percentileThresholds: readonly number[];
  public readonly dashboardRefreshCadenceMs: number;
  public readonly trendBucketSizeMs: number;
  public readonly historyRetentionLimit: number;

  constructor(props: KnowledgeAnalyticsConfigurationProps = {}) {
    const percentileThresholds = props.percentileThresholds ?? [95, 99];
    for (const threshold of percentileThresholds) {
      if (threshold < 0 || threshold > 100) {
        throw new InvalidSampleException(
          `percentile threshold must be between 0 and 100, received ${threshold}`,
        );
      }
    }
    const dashboardRefreshCadenceMs = props.dashboardRefreshCadenceMs ?? 60_000;
    if (dashboardRefreshCadenceMs <= 0) {
      throw new InvalidSampleException(
        `dashboardRefreshCadenceMs must be positive, received ${dashboardRefreshCadenceMs}`,
      );
    }
    const trendBucketSizeMs = props.trendBucketSizeMs ?? 3_600_000;
    if (trendBucketSizeMs <= 0) {
      throw new InvalidSampleException(
        `trendBucketSizeMs must be positive, received ${trendBucketSizeMs}`,
      );
    }
    const historyRetentionLimit = props.historyRetentionLimit ?? 0;
    if (historyRetentionLimit < 0) {
      throw new InvalidSampleException(
        `historyRetentionLimit must be non-negative, received ${historyRetentionLimit}`,
      );
    }

    this.percentileThresholds = Object.freeze([...percentileThresholds]);
    this.dashboardRefreshCadenceMs = dashboardRefreshCadenceMs;
    this.trendBucketSizeMs = trendBucketSizeMs;
    this.historyRetentionLimit = historyRetentionLimit;
    Object.freeze(this);
  }

  /** Returns a new configuration with `overrides` merged over the current values. */
  with(overrides: KnowledgeAnalyticsConfigurationProps): KnowledgeAnalyticsConfiguration {
    return new KnowledgeAnalyticsConfiguration({
      percentileThresholds: overrides.percentileThresholds ?? this.percentileThresholds,
      dashboardRefreshCadenceMs:
        overrides.dashboardRefreshCadenceMs ?? this.dashboardRefreshCadenceMs,
      trendBucketSizeMs: overrides.trendBucketSizeMs ?? this.trendBucketSizeMs,
      historyRetentionLimit: overrides.historyRetentionLimit ?? this.historyRetentionLimit,
    });
  }
}
