import { describe, expect, it } from "vitest";

import { KnowledgeIntelligenceRegistry } from "../../src/registry/knowledge-intelligence-registry.js";
import { KnowledgeIntelligenceStatisticsService } from "../../src/services/knowledge-intelligence-statistics-service.js";
import { RecommendationType } from "../../src/types/recommendation-type.js";
import { KnowledgeRecommendation } from "../../src/value-objects/knowledge-recommendation.js";

describe("KnowledgeIntelligenceStatisticsService", () => {
  it("summarizes an empty registry", () => {
    const service = new KnowledgeIntelligenceStatisticsService();
    const summary = service.summarize(new KnowledgeIntelligenceRegistry());
    expect(summary.reportCount).toBe(0);
    expect(summary.recommendationsByType[RecommendationType.Merge]).toBe(0);
  });

  it("summarizes a populated registry, grouping recommendations by type", () => {
    const registry = new KnowledgeIntelligenceRegistry();
    registry.putRecommendation(
      new KnowledgeRecommendation({
        id: "r1",
        type: RecommendationType.Merge,
        itemIds: ["a", "b"],
        reason: "x",
        priority: 50,
        createdAt: 0,
      }),
    );
    registry.putRecommendation(
      new KnowledgeRecommendation({
        id: "r2",
        type: RecommendationType.Merge,
        itemIds: ["c", "d"],
        reason: "y",
        priority: 50,
        createdAt: 0,
      }),
    );
    registry.putRecommendation(
      new KnowledgeRecommendation({
        id: "r3",
        type: RecommendationType.Archive,
        itemIds: ["e"],
        reason: "z",
        priority: 50,
        createdAt: 0,
      }),
    );

    const service = new KnowledgeIntelligenceStatisticsService();
    const summary = service.summarize(registry);
    expect(summary.recommendationCount).toBe(3);
    expect(summary.recommendationsByType[RecommendationType.Merge]).toBe(2);
    expect(summary.recommendationsByType[RecommendationType.Archive]).toBe(1);
    expect(summary.recommendationsByType[RecommendationType.Improvement]).toBe(0);
  });
});
