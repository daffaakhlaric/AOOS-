import { KnowledgeMetricName } from "../types/metric-name.js";

import {
  BaseKnowledgeAnalyticsService,
  type BaseKnowledgeAnalyticsServiceOptions,
} from "./base-knowledge-analytics-service.js";

/**
 * Owns: Embedding Cost, Query Cost. Both are recorded in an abstract currency unit (whatever unit
 * the caller supplies — this package performs no currency conversion).
 */
export class KnowledgeCostAnalytics extends BaseKnowledgeAnalyticsService {
  constructor(options: BaseKnowledgeAnalyticsServiceOptions = {}) {
    super(options);
  }

  recordEmbeddingCost(amount: number, provider?: string): void {
    this.record(KnowledgeMetricName.EmbeddingCost, amount, provider ? { provider } : {});
    this.publish(KnowledgeMetricName.EmbeddingCost, this.totalEmbeddingCost());
  }

  totalEmbeddingCost(): number {
    return this.calculator.sum(this.valuesFor(KnowledgeMetricName.EmbeddingCost));
  }

  embeddingCostByProvider(): Readonly<Record<string, number>> {
    return this.aggregateByTag(KnowledgeMetricName.EmbeddingCost, "provider");
  }

  recordQueryCost(amount: number, provider?: string): void {
    this.record(KnowledgeMetricName.QueryCost, amount, provider ? { provider } : {});
    this.publish(KnowledgeMetricName.QueryCost, this.totalQueryCost());
  }

  totalQueryCost(): number {
    return this.calculator.sum(this.valuesFor(KnowledgeMetricName.QueryCost));
  }

  queryCostByProvider(): Readonly<Record<string, number>> {
    return this.aggregateByTag(KnowledgeMetricName.QueryCost, "provider");
  }

  totalCost(): number {
    return this.totalEmbeddingCost() + this.totalQueryCost();
  }

  summary(): Readonly<Record<string, unknown>> {
    return {
      totalEmbeddingCost: this.totalEmbeddingCost(),
      totalQueryCost: this.totalQueryCost(),
      totalCost: this.totalCost(),
    };
  }
}
