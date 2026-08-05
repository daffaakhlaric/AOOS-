import { describe, expect, it } from "vitest";

import { KnowledgeRankingStrategy } from "../../src/domain/knowledge-ranking-strategy.js";

describe("KnowledgeRankingStrategy", () => {
  it("has exactly 7 ranking strategies", () => {
    expect(Object.values(KnowledgeRankingStrategy)).toHaveLength(7);
  });

  it("includes BM25, HYBRID, LLM_RANKING", () => {
    expect(KnowledgeRankingStrategy.BM25).toBe("bm25");
    expect(KnowledgeRankingStrategy.HYBRID).toBe("hybrid");
    expect(KnowledgeRankingStrategy.LLM_RANKING).toBe("llm_ranking");
  });
});
