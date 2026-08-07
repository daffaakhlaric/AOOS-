import { describe, expect, it } from "vitest";

import { KnowledgeIntelligenceStatistics } from "../../src/value-objects/knowledge-intelligence-statistics.js";

describe("KnowledgeIntelligenceStatistics", () => {
  it("returns an all-zero statistics object via empty()", () => {
    const stats = KnowledgeIntelligenceStatistics.empty();
    expect(stats.itemsAnalyzed).toBe(0);
    expect(stats.averageHealthScore).toBe(0);
  });

  it("is frozen (immutable)", () => {
    expect(Object.isFrozen(KnowledgeIntelligenceStatistics.empty())).toBe(true);
  });

  it("constructs with explicit values", () => {
    const stats = new KnowledgeIntelligenceStatistics({
      itemsAnalyzed: 10,
      findingsCount: 2,
      insightsCount: 1,
      recommendationsCount: 3,
      duplicatesCount: 1,
      nearDuplicatesCount: 2,
      relationshipsCount: 4,
      gapsCount: 1,
      orphansCount: 0,
      averageHealthScore: 80,
      averageQualityScore: 75,
      averageFreshnessScore: 90,
      averageRiskScore: 20,
    });
    expect(stats.itemsAnalyzed).toBe(10);
  });

  it("throws when any counter is negative", () => {
    const base = KnowledgeIntelligenceStatistics.empty();
    expect(() => new KnowledgeIntelligenceStatistics({ ...base, itemsAnalyzed: -1 })).toThrow(
      RangeError,
    );
  });
});
