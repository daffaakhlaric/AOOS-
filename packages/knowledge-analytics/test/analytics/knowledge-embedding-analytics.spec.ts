import { describe, expect, it } from "vitest";

import { KnowledgeEmbeddingAnalytics } from "../../src/analytics/knowledge-embedding-analytics.js";

describe("KnowledgeEmbeddingAnalytics", () => {
  it("counts every recorded embedding", () => {
    const embedding = new KnowledgeEmbeddingAnalytics();
    embedding.recordEmbedding({ durationMs: 10, tokens: 5 });
    embedding.recordEmbedding({ durationMs: 20, tokens: 15 });
    expect(embedding.embeddingCount()).toBe(2);
  });

  it("returns 0 for every metric with no recordings", () => {
    const embedding = new KnowledgeEmbeddingAnalytics();
    expect(embedding.embeddingCount()).toBe(0);
    expect(embedding.averageEmbeddingTime()).toBe(0);
    expect(embedding.p95EmbeddingTime()).toBe(0);
    expect(embedding.totalTokenUsage()).toBe(0);
    expect(embedding.averageTokenUsage()).toBe(0);
  });

  it("computes the exact average embedding time", () => {
    const embedding = new KnowledgeEmbeddingAnalytics();
    embedding.recordEmbedding({ durationMs: 10, tokens: 1 });
    embedding.recordEmbedding({ durationMs: 30, tokens: 1 });
    expect(embedding.averageEmbeddingTime()).toBe(20);
  });

  it("computes the exact total and average token usage", () => {
    const embedding = new KnowledgeEmbeddingAnalytics();
    embedding.recordEmbedding({ durationMs: 1, tokens: 100 });
    embedding.recordEmbedding({ durationMs: 1, tokens: 200 });
    expect(embedding.totalTokenUsage()).toBe(300);
    expect(embedding.averageTokenUsage()).toBe(150);
  });

  it("computes P95 embedding time", () => {
    const embedding = new KnowledgeEmbeddingAnalytics();
    for (let i = 1; i <= 100; i += 1) embedding.recordEmbedding({ durationMs: i, tokens: 1 });
    expect(embedding.p95EmbeddingTime()).toBeCloseTo(95.05, 10);
  });

  it("summary reports every owned metric", () => {
    const embedding = new KnowledgeEmbeddingAnalytics();
    embedding.recordEmbedding({ durationMs: 10, tokens: 5 });
    expect(embedding.summary()).toEqual({
      embeddingCount: 1,
      averageEmbeddingTime: 10,
      p95EmbeddingTime: 10,
      totalTokenUsage: 5,
      averageTokenUsage: 5,
    });
  });
});
