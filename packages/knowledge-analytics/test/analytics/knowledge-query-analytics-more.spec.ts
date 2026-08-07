import { describe, expect, it } from "vitest";

import { KnowledgeQueryAnalytics } from "../../src/analytics/knowledge-query-analytics.js";

describe("KnowledgeQueryAnalytics edge cases", () => {
  it("P95 and P99 equal the single value for exactly one recording", () => {
    const query = new KnowledgeQueryAnalytics();
    query.recordQueryTime(42);
    expect(query.p95QueryTime()).toBe(42);
    expect(query.p99QueryTime()).toBe(42);
    expect(query.averageQueryTime()).toBe(42);
  });

  it("handles two recordings via interpolation", () => {
    const query = new KnowledgeQueryAnalytics();
    query.recordQueryTime(10);
    query.recordQueryTime(20);
    // index = 0.95 * 1 = 0.95 -> 10 + 0.95*(20-10) = 19.5
    expect(query.p95QueryTime()).toBeCloseTo(19.5, 10);
  });

  it("handles a constant series (all percentiles equal the constant)", () => {
    const query = new KnowledgeQueryAnalytics();
    for (let i = 0; i < 10; i += 1) query.recordQueryTime(100);
    expect(query.averageQueryTime()).toBe(100);
    expect(query.p95QueryTime()).toBe(100);
    expect(query.p99QueryTime()).toBe(100);
  });

  it("queryCount reflects every recorded sample, including duplicates", () => {
    const query = new KnowledgeQueryAnalytics();
    query.recordQueryTime(5);
    query.recordQueryTime(5);
    query.recordQueryTime(5);
    expect(query.queryCount()).toBe(3);
  });
});
