import type { KnowledgeIntelligenceRegistry } from "../registry/knowledge-intelligence-registry.js";
import { RecommendationType } from "../types/recommendation-type.js";

export interface RegistryStatisticsSnapshot {
  readonly reportCount: number;
  readonly snapshotCount: number;
  readonly recommendationCount: number;
  readonly insightCount: number;
  readonly recommendationsByType: Readonly<Record<RecommendationType, number>>;
}

/**
 * Top-level orchestration helper that doesn't fit cleanly into a more specific folder: summarizes
 * a `KnowledgeIntelligenceRegistry`'s accumulated state across one or more pipeline runs (useful
 * for host dashboards that don't want to re-run the pipeline just to see aggregate counts).
 */
export class KnowledgeIntelligenceStatisticsService {
  summarize(registry: KnowledgeIntelligenceRegistry): RegistryStatisticsSnapshot {
    const recommendations = registry.listRecommendations();
    const recommendationsByType = Object.fromEntries(
      Object.values(RecommendationType).map((type) => [
        type,
        recommendations.filter((r) => r.type === type).length,
      ]),
    ) as Record<RecommendationType, number>;

    return {
      reportCount: registry.listReports().length,
      snapshotCount: registry.listSnapshots().length,
      recommendationCount: recommendations.length,
      insightCount: registry.listInsights().length,
      recommendationsByType,
    };
  }
}
