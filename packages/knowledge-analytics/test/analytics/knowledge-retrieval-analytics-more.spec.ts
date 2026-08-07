import { describe, expect, it } from "vitest";

import { KnowledgeRetrievalAnalytics } from "../../src/analytics/knowledge-retrieval-analytics.js";

describe("KnowledgeRetrievalAnalytics edge cases", () => {
  it("cacheHitRate is 0 when there are only misses", () => {
    const retrieval = new KnowledgeRetrievalAnalytics();
    retrieval.recordRetrieval({ cacheHit: false });
    retrieval.recordRetrieval({ cacheHit: false });
    expect(retrieval.cacheHitRate()).toBe(0);
  });

  it("cacheHitRate is 1 when there are only hits", () => {
    const retrieval = new KnowledgeRetrievalAnalytics();
    retrieval.recordRetrieval({ cacheHit: true });
    expect(retrieval.cacheHitRate()).toBe(1);
  });

  it("retrievalCount always equals cacheHitCount + cacheMissCount", () => {
    const retrieval = new KnowledgeRetrievalAnalytics();
    for (let i = 0; i < 50; i += 1) retrieval.recordRetrieval({ cacheHit: i % 3 === 0 });
    expect(retrieval.retrievalCount()).toBe(retrieval.cacheHitCount() + retrieval.cacheMissCount());
  });

  it("keeps history retention limit independent per metric (retrievalCount vs cacheHit/miss)", () => {
    const retrieval = new KnowledgeRetrievalAnalytics({ historyRetentionLimit: 2 });
    for (let i = 0; i < 5; i += 1) retrieval.recordRetrieval({ cacheHit: true });
    expect(retrieval.cacheHitCount()).toBe(2);
    expect(retrieval.retrievalCount()).toBe(2);
  });
});
