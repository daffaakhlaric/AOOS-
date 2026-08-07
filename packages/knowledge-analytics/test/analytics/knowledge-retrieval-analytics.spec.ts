import { describe, expect, it } from "vitest";

import { KnowledgeRetrievalAnalytics } from "../../src/analytics/knowledge-retrieval-analytics.js";

describe("KnowledgeRetrievalAnalytics", () => {
  it("counts every retrieval", () => {
    const retrieval = new KnowledgeRetrievalAnalytics();
    retrieval.recordRetrieval({ cacheHit: true });
    retrieval.recordRetrieval({ cacheHit: false });
    expect(retrieval.retrievalCount()).toBe(2);
  });

  it("returns 0 for every metric with no recordings", () => {
    const retrieval = new KnowledgeRetrievalAnalytics();
    expect(retrieval.retrievalCount()).toBe(0);
    expect(retrieval.cacheHitCount()).toBe(0);
    expect(retrieval.cacheMissCount()).toBe(0);
    expect(retrieval.cacheHitRate()).toBe(0);
  });

  it("separately tracks cache hits and misses", () => {
    const retrieval = new KnowledgeRetrievalAnalytics();
    retrieval.recordRetrieval({ cacheHit: true });
    retrieval.recordRetrieval({ cacheHit: true });
    retrieval.recordRetrieval({ cacheHit: false });
    expect(retrieval.cacheHitCount()).toBe(2);
    expect(retrieval.cacheMissCount()).toBe(1);
  });

  it("computes the exact cache hit rate", () => {
    const retrieval = new KnowledgeRetrievalAnalytics();
    for (let i = 0; i < 3; i += 1) retrieval.recordRetrieval({ cacheHit: true });
    retrieval.recordRetrieval({ cacheHit: false });
    expect(retrieval.cacheHitRate()).toBe(0.75);
  });

  it("summary reports every owned metric", () => {
    const retrieval = new KnowledgeRetrievalAnalytics();
    retrieval.recordRetrieval({ cacheHit: true });
    expect(retrieval.summary()).toEqual({
      retrievalCount: 1,
      cacheHitCount: 1,
      cacheMissCount: 0,
      cacheHitRate: 1,
    });
  });
});
