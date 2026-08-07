import { describe, expect, it } from "vitest";

import { KnowledgeSearchAnalytics } from "../../src/analytics/knowledge-search-analytics.js";
import { HIT_MISS_SEQUENCE, HIT_MISS_STATS } from "../helpers/fixtures.js";

describe("KnowledgeSearchAnalytics", () => {
  it("counts every recorded search", () => {
    const search = new KnowledgeSearchAnalytics();
    search.recordSearch({ hit: true });
    search.recordSearch({ hit: false });
    expect(search.searchCount()).toBe(2);
  });

  it("returns 0 for every metric with no recordings", () => {
    const search = new KnowledgeSearchAnalytics();
    expect(search.searchCount()).toBe(0);
    expect(search.hitRate()).toBe(0);
    expect(search.missRate()).toBe(0);
  });

  it("computes the exact hit rate over the known 80/20 fixture", () => {
    const search = new KnowledgeSearchAnalytics();
    for (const hit of HIT_MISS_SEQUENCE) search.recordSearch({ hit });
    expect(search.searchCount()).toBe(HIT_MISS_STATS.total);
    expect(search.hitRate()).toBeCloseTo(HIT_MISS_STATS.hitRate, 10);
  });

  it("computes the exact miss rate over the known 80/20 fixture", () => {
    const search = new KnowledgeSearchAnalytics();
    for (const hit of HIT_MISS_SEQUENCE) search.recordSearch({ hit });
    expect(search.missRate()).toBeCloseTo(HIT_MISS_STATS.missRate, 10);
  });

  it("hitRate + missRate sum to 1 when every search is recorded", () => {
    const search = new KnowledgeSearchAnalytics();
    for (const hit of HIT_MISS_SEQUENCE) search.recordSearch({ hit });
    expect(search.hitRate() + search.missRate()).toBeCloseTo(1, 10);
  });

  it("reports hitRate 1 and missRate 0 when every search hits", () => {
    const search = new KnowledgeSearchAnalytics();
    search.recordSearch({ hit: true });
    search.recordSearch({ hit: true });
    expect(search.hitRate()).toBe(1);
    expect(search.missRate()).toBe(0);
  });

  it("summary reports every owned metric", () => {
    const search = new KnowledgeSearchAnalytics();
    search.recordSearch({ hit: true });
    expect(search.summary()).toEqual({ searchCount: 1, hitRate: 1, missRate: 0 });
  });
});
