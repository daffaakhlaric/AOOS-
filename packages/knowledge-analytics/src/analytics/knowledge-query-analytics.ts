import { KnowledgeMetricName } from "../types/metric-name.js";

import {
  BaseKnowledgeAnalyticsService,
  type BaseKnowledgeAnalyticsServiceOptions,
} from "./base-knowledge-analytics-service.js";

/**
 * Owns: Average Query Time, P95 Query Time, P99 Query Time.
 */
export class KnowledgeQueryAnalytics extends BaseKnowledgeAnalyticsService {
  constructor(options: BaseKnowledgeAnalyticsServiceOptions = {}) {
    super(options);
  }

  recordQueryTime(durationMs: number): void {
    this.record(KnowledgeMetricName.AverageQueryTime, durationMs);
    this.publish(KnowledgeMetricName.AverageQueryTime, this.averageQueryTime());
    this.publish(KnowledgeMetricName.P95QueryTime, this.p95QueryTime());
    this.publish(KnowledgeMetricName.P99QueryTime, this.p99QueryTime());
  }

  queryCount(): number {
    return this.valuesFor(KnowledgeMetricName.AverageQueryTime).length;
  }

  averageQueryTime(): number {
    const values = this.valuesFor(KnowledgeMetricName.AverageQueryTime);
    return values.length === 0 ? 0 : this.calculator.average(values);
  }

  p95QueryTime(): number {
    const values = this.valuesFor(KnowledgeMetricName.AverageQueryTime);
    return values.length === 0 ? 0 : this.calculator.percentile(values, 95);
  }

  p99QueryTime(): number {
    const values = this.valuesFor(KnowledgeMetricName.AverageQueryTime);
    return values.length === 0 ? 0 : this.calculator.percentile(values, 99);
  }

  summary(): Readonly<Record<string, unknown>> {
    return {
      queryCount: this.queryCount(),
      averageQueryTime: this.averageQueryTime(),
      p95QueryTime: this.p95QueryTime(),
      p99QueryTime: this.p99QueryTime(),
    };
  }
}
