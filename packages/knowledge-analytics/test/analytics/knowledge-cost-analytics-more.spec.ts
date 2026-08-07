import { describe, expect, it } from "vitest";

import { KnowledgeCostAnalytics } from "../../src/analytics/knowledge-cost-analytics.js";

describe("KnowledgeCostAnalytics edge cases", () => {
  it("supports fractional cost amounts precisely", () => {
    const cost = new KnowledgeCostAnalytics();
    cost.recordEmbeddingCost(0.001);
    cost.recordEmbeddingCost(0.002);
    expect(cost.totalEmbeddingCost()).toBeCloseTo(0.003, 10);
  });

  it("supports zero-cost recordings", () => {
    const cost = new KnowledgeCostAnalytics();
    cost.recordQueryCost(0);
    expect(cost.totalQueryCost()).toBe(0);
  });

  it("aggregates multiple providers across both embedding and query cost independently", () => {
    const cost = new KnowledgeCostAnalytics();
    cost.recordEmbeddingCost(1, "openai");
    cost.recordQueryCost(2, "openai");
    expect(cost.embeddingCostByProvider()).toEqual({ openai: 1 });
    expect(cost.queryCostByProvider()).toEqual({ openai: 2 });
  });
});
