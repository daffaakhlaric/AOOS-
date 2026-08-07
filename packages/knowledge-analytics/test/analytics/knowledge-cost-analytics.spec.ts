import { describe, expect, it } from "vitest";

import { KnowledgeCostAnalytics } from "../../src/analytics/knowledge-cost-analytics.js";

describe("KnowledgeCostAnalytics", () => {
  it("returns 0 for every metric with no recordings", () => {
    const cost = new KnowledgeCostAnalytics();
    expect(cost.totalEmbeddingCost()).toBe(0);
    expect(cost.totalQueryCost()).toBe(0);
    expect(cost.totalCost()).toBe(0);
  });

  it("accumulates embedding cost", () => {
    const cost = new KnowledgeCostAnalytics();
    cost.recordEmbeddingCost(0.5);
    cost.recordEmbeddingCost(0.25);
    expect(cost.totalEmbeddingCost()).toBe(0.75);
  });

  it("accumulates query cost", () => {
    const cost = new KnowledgeCostAnalytics();
    cost.recordQueryCost(1);
    cost.recordQueryCost(2);
    expect(cost.totalQueryCost()).toBe(3);
  });

  it("totalCost sums embedding and query cost", () => {
    const cost = new KnowledgeCostAnalytics();
    cost.recordEmbeddingCost(1);
    cost.recordQueryCost(2);
    expect(cost.totalCost()).toBe(3);
  });

  it("tracks cost per provider when provided", () => {
    const cost = new KnowledgeCostAnalytics();
    cost.recordEmbeddingCost(1, "openai");
    cost.recordEmbeddingCost(2, "anthropic");
    expect(cost.embeddingCostByProvider()).toEqual({ openai: 1, anthropic: 2 });
  });

  it("omits samples with no provider from the per-provider breakdown", () => {
    const cost = new KnowledgeCostAnalytics();
    cost.recordQueryCost(1);
    cost.recordQueryCost(2, "openai");
    expect(cost.queryCostByProvider()).toEqual({ openai: 2 });
  });

  it("summary reports every owned metric", () => {
    const cost = new KnowledgeCostAnalytics();
    cost.recordEmbeddingCost(1);
    cost.recordQueryCost(2);
    expect(cost.summary()).toEqual({ totalEmbeddingCost: 1, totalQueryCost: 2, totalCost: 3 });
  });
});
