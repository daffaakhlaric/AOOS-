import { KnowledgeMetricName } from "../types/metric-name.js";

import {
  BaseKnowledgeAnalyticsService,
  type BaseKnowledgeAnalyticsServiceOptions,
} from "./base-knowledge-analytics-service.js";

/** Constructor properties for {@link KnowledgeEmbeddingAnalytics.recordEmbedding}. */
export interface EmbeddingEvent {
  readonly durationMs: number;
  readonly tokens: number;
}

/**
 * Owns: Embedding Time, Token Usage.
 */
export class KnowledgeEmbeddingAnalytics extends BaseKnowledgeAnalyticsService {
  constructor(options: BaseKnowledgeAnalyticsServiceOptions = {}) {
    super(options);
  }

  recordEmbedding(event: EmbeddingEvent): void {
    this.record(KnowledgeMetricName.EmbeddingTime, event.durationMs);
    this.record(KnowledgeMetricName.TokenUsage, event.tokens);
    this.publish(KnowledgeMetricName.EmbeddingTime, this.averageEmbeddingTime());
    this.publish(KnowledgeMetricName.TokenUsage, this.totalTokenUsage());
  }

  embeddingCount(): number {
    return this.valuesFor(KnowledgeMetricName.EmbeddingTime).length;
  }

  averageEmbeddingTime(): number {
    const values = this.valuesFor(KnowledgeMetricName.EmbeddingTime);
    return values.length === 0 ? 0 : this.calculator.average(values);
  }

  p95EmbeddingTime(): number {
    const values = this.valuesFor(KnowledgeMetricName.EmbeddingTime);
    return values.length === 0 ? 0 : this.calculator.percentile(values, 95);
  }

  totalTokenUsage(): number {
    return this.calculator.sum(this.valuesFor(KnowledgeMetricName.TokenUsage));
  }

  averageTokenUsage(): number {
    const values = this.valuesFor(KnowledgeMetricName.TokenUsage);
    return values.length === 0 ? 0 : this.calculator.average(values);
  }

  summary(): Readonly<Record<string, unknown>> {
    return {
      embeddingCount: this.embeddingCount(),
      averageEmbeddingTime: this.averageEmbeddingTime(),
      p95EmbeddingTime: this.p95EmbeddingTime(),
      totalTokenUsage: this.totalTokenUsage(),
      averageTokenUsage: this.averageTokenUsage(),
    };
  }
}
