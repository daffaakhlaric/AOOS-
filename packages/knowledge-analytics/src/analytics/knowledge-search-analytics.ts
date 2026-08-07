import { KnowledgeMetricName } from "../types/metric-name.js";

import {
  BaseKnowledgeAnalyticsService,
  type BaseKnowledgeAnalyticsServiceOptions,
} from "./base-knowledge-analytics-service.js";

/** Constructor properties for {@link KnowledgeSearchAnalytics.recordSearch}. */
export interface SearchEvent {
  readonly hit: boolean;
}

/**
 * Owns: Search Count, Hit Rate, Miss Rate.
 */
export class KnowledgeSearchAnalytics extends BaseKnowledgeAnalyticsService {
  constructor(options: BaseKnowledgeAnalyticsServiceOptions = {}) {
    super(options);
  }

  recordSearch(event: SearchEvent): void {
    this.record(KnowledgeMetricName.SearchCount, 1, { hit: String(event.hit) });
    this.publish(KnowledgeMetricName.SearchCount, this.searchCount());
    this.publish(KnowledgeMetricName.HitRate, this.hitRate());
    this.publish(KnowledgeMetricName.MissRate, this.missRate());
  }

  searchCount(): number {
    return this.valuesFor(KnowledgeMetricName.SearchCount).length;
  }

  private hitCount(): number {
    return this.samplesFor(KnowledgeMetricName.SearchCount).filter(
      (sample) => sample.tags.hit === "true",
    ).length;
  }

  private missCount(): number {
    return this.samplesFor(KnowledgeMetricName.SearchCount).filter(
      (sample) => sample.tags.hit === "false",
    ).length;
  }

  hitRate(): number {
    return this.calculator.rate(this.hitCount(), this.searchCount());
  }

  missRate(): number {
    return this.calculator.rate(this.missCount(), this.searchCount());
  }

  summary(): Readonly<Record<string, unknown>> {
    return {
      searchCount: this.searchCount(),
      hitRate: this.hitRate(),
      missRate: this.missRate(),
    };
  }
}
