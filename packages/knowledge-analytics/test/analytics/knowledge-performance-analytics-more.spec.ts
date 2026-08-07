import { describe, expect, it } from "vitest";

import { KnowledgePerformanceAnalytics } from "../../src/analytics/knowledge-performance-analytics.js";

describe("KnowledgePerformanceAnalytics edge cases", () => {
  it("tracks multiple named operations independently and precisely", () => {
    const performance = new KnowledgePerformanceAnalytics();
    performance.recordOperation("a", 1);
    performance.recordOperation("a", 3);
    performance.recordOperation("b", 100);
    expect(performance.averageOperationTime("a")).toBe(2);
    expect(performance.averageOperationTime("b")).toBe(100);
  });

  it("recordOperation does not affect retrievalCount/averageRetrievalTime", () => {
    const performance = new KnowledgePerformanceAnalytics();
    performance.recordOperation("index", 10);
    expect(performance.retrievalCount()).toBe(0);
    expect(performance.averageRetrievalTime()).toBe(0);
  });

  it("computes exact P95/P99 for a small retrieval-time sample", () => {
    const performance = new KnowledgePerformanceAnalytics();
    [10, 20, 30, 40, 50].forEach((v) => performance.recordRetrievalTime(v));
    expect(performance.p95RetrievalTime()).toBe(48);
    expect(performance.p99RetrievalTime()).toBeCloseTo(49.6, 10);
  });
});
