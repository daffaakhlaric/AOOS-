import { describe, expect, it } from "vitest";

import { KnowledgeQueryAnalytics } from "../../src/analytics/knowledge-query-analytics.js";
import { ONE_TO_HUNDRED, ONE_TO_HUNDRED_STATS } from "../helpers/fixtures.js";

describe("KnowledgeQueryAnalytics", () => {
  it("counts every recorded query", () => {
    const query = new KnowledgeQueryAnalytics();
    query.recordQueryTime(10);
    query.recordQueryTime(20);
    expect(query.queryCount()).toBe(2);
  });

  it("returns 0 for every metric with no recordings", () => {
    const query = new KnowledgeQueryAnalytics();
    expect(query.queryCount()).toBe(0);
    expect(query.averageQueryTime()).toBe(0);
    expect(query.p95QueryTime()).toBe(0);
    expect(query.p99QueryTime()).toBe(0);
  });

  it("computes the exact average over 1..100ms", () => {
    const query = new KnowledgeQueryAnalytics();
    for (const value of ONE_TO_HUNDRED) query.recordQueryTime(value);
    expect(query.averageQueryTime()).toBe(ONE_TO_HUNDRED_STATS.average);
  });

  it("computes the exact P95 over 1..100ms", () => {
    const query = new KnowledgeQueryAnalytics();
    for (const value of ONE_TO_HUNDRED) query.recordQueryTime(value);
    expect(query.p95QueryTime()).toBeCloseTo(ONE_TO_HUNDRED_STATS.p95, 10);
  });

  it("computes the exact P99 over 1..100ms", () => {
    const query = new KnowledgeQueryAnalytics();
    for (const value of ONE_TO_HUNDRED) query.recordQueryTime(value);
    expect(query.p99QueryTime()).toBeCloseTo(ONE_TO_HUNDRED_STATS.p99, 10);
  });

  it("summary reports every owned metric", () => {
    const query = new KnowledgeQueryAnalytics();
    query.recordQueryTime(100);
    expect(query.summary()).toEqual({
      queryCount: 1,
      averageQueryTime: 100,
      p95QueryTime: 100,
      p99QueryTime: 100,
    });
  });
});
