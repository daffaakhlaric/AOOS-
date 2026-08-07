import { describe, expect, it } from "vitest";

import { KnowledgeRecommendationAnalytics } from "../../src/analytics/knowledge-recommendation-analytics.js";

describe("KnowledgeRecommendationAnalytics", () => {
  it("returns empty rankings with no recordings", () => {
    const recommendation = new KnowledgeRecommendationAnalytics();
    expect(recommendation.mostAccessedKnowledge()).toEqual([]);
    expect(recommendation.leastAccessedKnowledge()).toEqual([]);
  });

  it("ranks knowledge items descending by access count for mostAccessedKnowledge", () => {
    const recommendation = new KnowledgeRecommendationAnalytics();
    recommendation.recordAccess("a", 5);
    recommendation.recordAccess("b", 10);
    recommendation.recordAccess("c", 1);
    expect(recommendation.mostAccessedKnowledge()).toEqual([
      { knowledgeId: "b", accessCount: 10 },
      { knowledgeId: "a", accessCount: 5 },
      { knowledgeId: "c", accessCount: 1 },
    ]);
  });

  it("ranks knowledge items ascending by access count for leastAccessedKnowledge", () => {
    const recommendation = new KnowledgeRecommendationAnalytics();
    recommendation.recordAccess("a", 5);
    recommendation.recordAccess("b", 10);
    recommendation.recordAccess("c", 1);
    expect(recommendation.leastAccessedKnowledge()).toEqual([
      { knowledgeId: "c", accessCount: 1 },
      { knowledgeId: "a", accessCount: 5 },
      { knowledgeId: "b", accessCount: 10 },
    ]);
  });

  it("accumulates multiple recordAccess calls for the same id", () => {
    const recommendation = new KnowledgeRecommendationAnalytics();
    recommendation.recordAccess("a", 1);
    recommendation.recordAccess("a", 1);
    recommendation.recordAccess("a", 1);
    expect(recommendation.mostAccessedKnowledge()).toEqual([{ knowledgeId: "a", accessCount: 3 }]);
  });

  it("respects the limit parameter", () => {
    const recommendation = new KnowledgeRecommendationAnalytics();
    recommendation.recordAccess("a", 3);
    recommendation.recordAccess("b", 2);
    recommendation.recordAccess("c", 1);
    expect(recommendation.mostAccessedKnowledge(2)).toHaveLength(2);
  });

  it("defaults recordAccess count to 1", () => {
    const recommendation = new KnowledgeRecommendationAnalytics();
    recommendation.recordAccess("a");
    expect(recommendation.mostAccessedKnowledge()).toEqual([{ knowledgeId: "a", accessCount: 1 }]);
  });

  it("summary reports both rankings", () => {
    const recommendation = new KnowledgeRecommendationAnalytics();
    recommendation.recordAccess("a", 1);
    const summary = recommendation.summary() as {
      mostAccessedKnowledge: unknown[];
      leastAccessedKnowledge: unknown[];
    };
    expect(summary.mostAccessedKnowledge).toHaveLength(1);
    expect(summary.leastAccessedKnowledge).toHaveLength(1);
  });
});
