import { KnowledgeMetricName } from "../types/metric-name.js";

import {
  BaseKnowledgeAnalyticsService,
  type BaseKnowledgeAnalyticsServiceOptions,
} from "./base-knowledge-analytics-service.js";

/** One ranked entry produced by {@link KnowledgeRecommendationAnalytics}. */
export interface KnowledgeAccessRanking {
  readonly knowledgeId: string;
  readonly accessCount: number;
}

/**
 * Owns: Most Accessed Knowledge, Least Accessed Knowledge.
 */
export class KnowledgeRecommendationAnalytics extends BaseKnowledgeAnalyticsService {
  constructor(options: BaseKnowledgeAnalyticsServiceOptions = {}) {
    super(options);
  }

  recordAccess(knowledgeId: string, count = 1): void {
    this.record(KnowledgeMetricName.MostAccessedKnowledge, count, { knowledgeId });
  }

  private ranking(): KnowledgeAccessRanking[] {
    const totals = this.aggregateByTag(KnowledgeMetricName.MostAccessedKnowledge, "knowledgeId");
    return Object.entries(totals)
      .map(([knowledgeId, accessCount]) => ({ knowledgeId, accessCount }))
      .sort((a, b) => b.accessCount - a.accessCount);
  }

  /** Top `limit` most-accessed knowledge items, descending by access count. */
  mostAccessedKnowledge(limit = 5): readonly KnowledgeAccessRanking[] {
    const result = this.ranking().slice(0, limit);
    this.publish(KnowledgeMetricName.MostAccessedKnowledge, result[0]?.accessCount ?? 0);
    return result;
  }

  /** Bottom `limit` least-accessed knowledge items, ascending by access count. */
  leastAccessedKnowledge(limit = 5): readonly KnowledgeAccessRanking[] {
    const ranked = this.ranking();
    const result = [...ranked].sort((a, b) => a.accessCount - b.accessCount).slice(0, limit);
    this.publish(KnowledgeMetricName.LeastAccessedKnowledge, result[0]?.accessCount ?? 0);
    return result;
  }

  summary(limit = 5): Readonly<Record<string, unknown>> {
    return {
      mostAccessedKnowledge: this.mostAccessedKnowledge(limit),
      leastAccessedKnowledge: this.leastAccessedKnowledge(limit),
    };
  }
}
