import { KnowledgeMetricName } from "../types/metric-name.js";

import {
  BaseKnowledgeAnalyticsService,
  type BaseKnowledgeAnalyticsServiceOptions,
} from "./base-knowledge-analytics-service.js";

/** Constructor properties for {@link KnowledgeRetrievalAnalytics.recordRetrieval}. */
export interface RetrievalEvent {
  readonly cacheHit: boolean;
}

/**
 * Owns: Retrieval Count, Cache Hit, Cache Miss.
 */
export class KnowledgeRetrievalAnalytics extends BaseKnowledgeAnalyticsService {
  constructor(options: BaseKnowledgeAnalyticsServiceOptions = {}) {
    super(options);
  }

  recordRetrieval(event: RetrievalEvent): void {
    this.record(KnowledgeMetricName.RetrievalCount, 1);
    if (event.cacheHit) {
      this.record(KnowledgeMetricName.CacheHit, 1);
    } else {
      this.record(KnowledgeMetricName.CacheMiss, 1);
    }
    this.publish(KnowledgeMetricName.RetrievalCount, this.retrievalCount());
    this.publish(KnowledgeMetricName.CacheHit, this.cacheHitCount());
    this.publish(KnowledgeMetricName.CacheMiss, this.cacheMissCount());
  }

  retrievalCount(): number {
    return this.valuesFor(KnowledgeMetricName.RetrievalCount).length;
  }

  cacheHitCount(): number {
    return this.valuesFor(KnowledgeMetricName.CacheHit).length;
  }

  cacheMissCount(): number {
    return this.valuesFor(KnowledgeMetricName.CacheMiss).length;
  }

  cacheHitRate(): number {
    return this.calculator.rate(this.cacheHitCount(), this.cacheHitCount() + this.cacheMissCount());
  }

  summary(): Readonly<Record<string, unknown>> {
    return {
      retrievalCount: this.retrievalCount(),
      cacheHitCount: this.cacheHitCount(),
      cacheMissCount: this.cacheMissCount(),
      cacheHitRate: this.cacheHitRate(),
    };
  }
}
