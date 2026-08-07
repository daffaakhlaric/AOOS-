import { describe, expect, it } from "vitest";

import { KnowledgeIntelligenceStatisticsFactory } from "../../src/factories/knowledge-intelligence-statistics-factory.js";

describe("KnowledgeIntelligenceStatisticsFactory", () => {
  it("creates a statistics value object from raw counters", () => {
    const factory = new KnowledgeIntelligenceStatisticsFactory();
    const stats = factory.create({
      itemsAnalyzed: 3,
      findingsCount: 0,
      insightsCount: 0,
      recommendationsCount: 0,
      duplicatesCount: 0,
      nearDuplicatesCount: 0,
      relationshipsCount: 0,
      gapsCount: 0,
      orphansCount: 0,
      averageHealthScore: 0,
      averageQualityScore: 0,
      averageFreshnessScore: 0,
      averageRiskScore: 0,
    });
    expect(stats.itemsAnalyzed).toBe(3);
  });
});
