import { KnowledgeMetricName } from "../types/metric-name.js";

import {
  BaseKnowledgeAnalyticsService,
  type BaseKnowledgeAnalyticsServiceOptions,
} from "./base-knowledge-analytics-service.js";

/**
 * Owns: Retrieval Time. Also generalizes it into `recordOperation`, allowing a host to track
 * latency for any named operation beyond retrieval (an extension point, not a raw named metric).
 */
export class KnowledgePerformanceAnalytics extends BaseKnowledgeAnalyticsService {
  constructor(options: BaseKnowledgeAnalyticsServiceOptions = {}) {
    super(options);
  }

  recordRetrievalTime(durationMs: number): void {
    this.record(KnowledgeMetricName.RetrievalTime, durationMs);
    this.publish(KnowledgeMetricName.RetrievalTime, this.averageRetrievalTime());
  }

  /** Records a latency reading for an arbitrary named operation (extension of Retrieval Time). */
  recordOperation(operationName: string, durationMs: number): void {
    this.record(`operation:${operationName}`, durationMs);
  }

  averageOperationTime(operationName: string): number {
    const values = this.valuesFor(`operation:${operationName}`);
    return values.length === 0 ? 0 : this.calculator.average(values);
  }

  operationCount(operationName: string): number {
    return this.valuesFor(`operation:${operationName}`).length;
  }

  retrievalCount(): number {
    return this.valuesFor(KnowledgeMetricName.RetrievalTime).length;
  }

  averageRetrievalTime(): number {
    const values = this.valuesFor(KnowledgeMetricName.RetrievalTime);
    return values.length === 0 ? 0 : this.calculator.average(values);
  }

  p95RetrievalTime(): number {
    const values = this.valuesFor(KnowledgeMetricName.RetrievalTime);
    return values.length === 0 ? 0 : this.calculator.percentile(values, 95);
  }

  p99RetrievalTime(): number {
    const values = this.valuesFor(KnowledgeMetricName.RetrievalTime);
    return values.length === 0 ? 0 : this.calculator.percentile(values, 99);
  }

  summary(): Readonly<Record<string, unknown>> {
    return {
      retrievalCount: this.retrievalCount(),
      averageRetrievalTime: this.averageRetrievalTime(),
      p95RetrievalTime: this.p95RetrievalTime(),
      p99RetrievalTime: this.p99RetrievalTime(),
    };
  }
}
