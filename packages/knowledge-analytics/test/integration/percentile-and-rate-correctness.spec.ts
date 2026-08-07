import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsEngine } from "../../src/services/knowledge-analytics-engine.js";
import { SMALL_LATENCY_SAMPLE, SMALL_LATENCY_STATS } from "../helpers/fixtures.js";

/**
 * Cross-checks that percentile/rate correctness holds not just at the calculator/analytics-service
 * level (see their dedicated spec files) but also when driven end-to-end through the engine.
 */
describe("Percentile and rate correctness through the engine", () => {
  it("computes exact P95/P99 query time through KnowledgeQueryAnalytics via the engine", () => {
    const engine = new KnowledgeAnalyticsEngine();
    for (const value of SMALL_LATENCY_SAMPLE) engine.query.recordQueryTime(value);
    expect(engine.query.p95QueryTime()).toBeCloseTo(SMALL_LATENCY_STATS.p95, 10);
    expect(engine.query.p99QueryTime()).toBeCloseTo(SMALL_LATENCY_STATS.p99, 10);
    expect(engine.query.averageQueryTime()).toBe(SMALL_LATENCY_STATS.average);
  });

  it("computes exact hit/miss rate for a known 7:3 split", () => {
    const engine = new KnowledgeAnalyticsEngine();
    for (let i = 0; i < 7; i += 1) engine.search.recordSearch({ hit: true });
    for (let i = 0; i < 3; i += 1) engine.search.recordSearch({ hit: false });
    expect(engine.search.hitRate()).toBe(0.7);
    expect(engine.search.missRate()).toBe(0.3);
  });

  it("computes exact success/failure rate for a known 9:1 split", () => {
    const engine = new KnowledgeAnalyticsEngine();
    for (let i = 0; i < 9; i += 1) engine.quality.recordQualityCheck({ succeeded: true });
    engine.quality.recordQualityCheck({ succeeded: false });
    expect(engine.quality.successRate()).toBe(0.9);
    expect(engine.quality.failureRate()).toBe(0.1);
  });

  it("computes exact cache hit rate for a known 2:1 split", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.retrieval.recordRetrieval({ cacheHit: true });
    engine.retrieval.recordRetrieval({ cacheHit: true });
    engine.retrieval.recordRetrieval({ cacheHit: false });
    expect(engine.retrieval.cacheHitRate()).toBeCloseTo(2 / 3, 10);
  });

  it("computes an exact average token usage across recorded embeddings", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.embedding.recordEmbedding({ durationMs: 1, tokens: 10 });
    engine.embedding.recordEmbedding({ durationMs: 1, tokens: 30 });
    expect(engine.embedding.averageTokenUsage()).toBe(20);
  });
});
