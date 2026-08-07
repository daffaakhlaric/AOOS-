import { describe, expect, it } from "vitest";

import { KnowledgePerformanceAnalytics } from "../../src/analytics/knowledge-performance-analytics.js";
import { ONE_TO_HUNDRED, ONE_TO_HUNDRED_STATS } from "../helpers/fixtures.js";

describe("KnowledgePerformanceAnalytics", () => {
  it("counts every recorded retrieval time", () => {
    const performance = new KnowledgePerformanceAnalytics();
    performance.recordRetrievalTime(10);
    performance.recordRetrievalTime(20);
    expect(performance.retrievalCount()).toBe(2);
  });

  it("returns 0 for every metric with no recordings", () => {
    const performance = new KnowledgePerformanceAnalytics();
    expect(performance.retrievalCount()).toBe(0);
    expect(performance.averageRetrievalTime()).toBe(0);
    expect(performance.p95RetrievalTime()).toBe(0);
    expect(performance.p99RetrievalTime()).toBe(0);
  });

  it("computes the exact average/P95/P99 retrieval time over 1..100ms", () => {
    const performance = new KnowledgePerformanceAnalytics();
    for (const value of ONE_TO_HUNDRED) performance.recordRetrievalTime(value);
    expect(performance.averageRetrievalTime()).toBe(ONE_TO_HUNDRED_STATS.average);
    expect(performance.p95RetrievalTime()).toBeCloseTo(ONE_TO_HUNDRED_STATS.p95, 10);
    expect(performance.p99RetrievalTime()).toBeCloseTo(ONE_TO_HUNDRED_STATS.p99, 10);
  });

  it("recordOperation tracks arbitrary named operations independently of retrieval time", () => {
    const performance = new KnowledgePerformanceAnalytics();
    performance.recordOperation("index", 5);
    performance.recordOperation("index", 15);
    performance.recordOperation("embed", 100);
    expect(performance.operationCount("index")).toBe(2);
    expect(performance.averageOperationTime("index")).toBe(10);
    expect(performance.operationCount("embed")).toBe(1);
    expect(performance.averageOperationTime("embed")).toBe(100);
    expect(performance.retrievalCount()).toBe(0);
  });

  it("returns 0 for an operation that was never recorded", () => {
    const performance = new KnowledgePerformanceAnalytics();
    expect(performance.operationCount("missing")).toBe(0);
    expect(performance.averageOperationTime("missing")).toBe(0);
  });

  it("summary reports every owned metric", () => {
    const performance = new KnowledgePerformanceAnalytics();
    performance.recordRetrievalTime(100);
    expect(performance.summary()).toEqual({
      retrievalCount: 1,
      averageRetrievalTime: 100,
      p95RetrievalTime: 100,
      p99RetrievalTime: 100,
    });
  });
});
