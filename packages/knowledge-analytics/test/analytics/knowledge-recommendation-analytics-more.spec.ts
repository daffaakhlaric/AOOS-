import { describe, expect, it } from "vitest";

import { KnowledgeRecommendationAnalytics } from "../../src/analytics/knowledge-recommendation-analytics.js";

describe("KnowledgeRecommendationAnalytics edge cases", () => {
  it("handles ties by preserving a stable but valid ordering", () => {
    const recommendation = new KnowledgeRecommendationAnalytics();
    recommendation.recordAccess("a", 5);
    recommendation.recordAccess("b", 5);
    const ranking = recommendation.mostAccessedKnowledge();
    expect(ranking.every((entry) => entry.accessCount === 5)).toBe(true);
    expect(ranking).toHaveLength(2);
  });

  it("mostAccessedKnowledge and leastAccessedKnowledge are exact opposites for a distinct dataset", () => {
    const recommendation = new KnowledgeRecommendationAnalytics();
    recommendation.recordAccess("a", 1);
    recommendation.recordAccess("b", 2);
    recommendation.recordAccess("c", 3);
    const most = recommendation.mostAccessedKnowledge(3);
    const least = recommendation.leastAccessedKnowledge(3);
    expect(most.map((e) => e.knowledgeId)).toEqual(["c", "b", "a"]);
    expect(least.map((e) => e.knowledgeId)).toEqual(["a", "b", "c"]);
  });

  it("limit of 0 returns an empty ranking", () => {
    const recommendation = new KnowledgeRecommendationAnalytics();
    recommendation.recordAccess("a", 1);
    expect(recommendation.mostAccessedKnowledge(0)).toEqual([]);
  });
});
