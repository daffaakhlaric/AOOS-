import {
  KnowledgeAnalyticsConfiguration,
  type KnowledgeAnalyticsConfigurationProps,
} from "../value-objects/knowledge-analytics-configuration.js";

/** Real Factory-pattern class for constructing {@link KnowledgeAnalyticsConfiguration}. */
export class KnowledgeAnalyticsConfigurationFactory {
  /** Default configuration (percentiles [95, 99], 1min dashboard cadence, 1h trend buckets). */
  createDefault(): KnowledgeAnalyticsConfiguration {
    return new KnowledgeAnalyticsConfiguration();
  }

  create(props: KnowledgeAnalyticsConfigurationProps): KnowledgeAnalyticsConfiguration {
    return new KnowledgeAnalyticsConfiguration(props);
  }

  /** Configuration tuned for high-frequency, short-lived test/demo scenarios. */
  createFastRefresh(): KnowledgeAnalyticsConfiguration {
    return new KnowledgeAnalyticsConfiguration({
      dashboardRefreshCadenceMs: 1_000,
      trendBucketSizeMs: 60_000,
    });
  }
}
