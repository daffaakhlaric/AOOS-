import { KnowledgeMetricName } from "../types/metric-name.js";

import {
  BaseKnowledgeAnalyticsService,
  type BaseKnowledgeAnalyticsServiceOptions,
} from "./base-knowledge-analytics-service.js";

/** Constructor properties for {@link KnowledgeQualityAnalytics.recordQualityCheck}. */
export interface QualityCheckEvent {
  readonly succeeded: boolean;
}

/**
 * Owns: Success Rate, Failure Rate. Also derives a synthesized "Quality Score" (0-1, equal to the
 * success rate) — a composite indicator, not one of the 30 raw named metrics, kept for report
 * readability.
 */
export class KnowledgeQualityAnalytics extends BaseKnowledgeAnalyticsService {
  constructor(options: BaseKnowledgeAnalyticsServiceOptions = {}) {
    super(options);
  }

  recordQualityCheck(event: QualityCheckEvent): void {
    this.record(KnowledgeMetricName.SuccessRate, event.succeeded ? 1 : 0, {
      succeeded: String(event.succeeded),
    });
    this.publish(KnowledgeMetricName.SuccessRate, this.successRate());
    this.publish(KnowledgeMetricName.FailureRate, this.failureRate());
  }

  checkCount(): number {
    return this.valuesFor(KnowledgeMetricName.SuccessRate).length;
  }

  private succeededCount(): number {
    return this.samplesFor(KnowledgeMetricName.SuccessRate).filter(
      (sample) => sample.tags.succeeded === "true",
    ).length;
  }

  successRate(): number {
    return this.calculator.rate(this.succeededCount(), this.checkCount());
  }

  failureRate(): number {
    return this.calculator.rate(this.checkCount() - this.succeededCount(), this.checkCount());
  }

  /** Composite quality score (0-1), currently defined as the success rate. */
  qualityScore(): number {
    return this.successRate();
  }

  summary(): Readonly<Record<string, unknown>> {
    return {
      checkCount: this.checkCount(),
      successRate: this.successRate(),
      failureRate: this.failureRate(),
      qualityScore: this.qualityScore(),
    };
  }
}
