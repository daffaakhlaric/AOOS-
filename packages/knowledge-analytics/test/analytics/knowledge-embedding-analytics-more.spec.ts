import { describe, expect, it } from "vitest";

import { KnowledgeEmbeddingAnalytics } from "../../src/analytics/knowledge-embedding-analytics.js";

describe("KnowledgeEmbeddingAnalytics edge cases", () => {
  it("allows zero-token embeddings", () => {
    const embedding = new KnowledgeEmbeddingAnalytics();
    embedding.recordEmbedding({ durationMs: 5, tokens: 0 });
    expect(embedding.totalTokenUsage()).toBe(0);
    expect(embedding.embeddingCount()).toBe(1);
  });

  it("embedding time and token usage are tracked independently per call", () => {
    const embedding = new KnowledgeEmbeddingAnalytics();
    embedding.recordEmbedding({ durationMs: 100, tokens: 1 });
    embedding.recordEmbedding({ durationMs: 200, tokens: 1000 });
    expect(embedding.averageEmbeddingTime()).toBe(150);
    expect(embedding.totalTokenUsage()).toBe(1001);
  });

  it("handles many embeddings without losing precision", () => {
    const embedding = new KnowledgeEmbeddingAnalytics();
    for (let i = 1; i <= 50; i += 1) embedding.recordEmbedding({ durationMs: i, tokens: i * 10 });
    expect(embedding.embeddingCount()).toBe(50);
    expect(embedding.totalTokenUsage()).toBe((10 * (50 * 51)) / 2);
  });
});
