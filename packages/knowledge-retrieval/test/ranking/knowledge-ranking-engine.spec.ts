import { describe, expect, it } from "vitest";

import { EMPTY_KNOWLEDGE_FILTER_SET } from "../../src/domain/knowledge-filter-set.js";
import { KnowledgeQueryType } from "../../src/domain/knowledge-query-type.js";
import { KnowledgeRankingStrategy } from "../../src/domain/knowledge-ranking-strategy.js";
import { KnowledgeSearchMode } from "../../src/domain/knowledge-search-mode.js";
import { RankingNotSupportedException } from "../../src/errors/ranking-not-supported-exception.js";
import { KnowledgeRankingEngine } from "../../src/ranking/knowledge-ranking-engine.js";
import { KnowledgeRetrievalRegistry } from "../../src/registry/knowledge-retrieval-registry.js";
import { contextFixture } from "../helpers/context-fixture.js";

const query = {
  id: "q-1",
  type: KnowledgeQueryType.KEYWORD,
  keywords: ["hi"],
  searchModes: [KnowledgeSearchMode.KEYWORD],
  filters: EMPTY_KNOWLEDGE_FILTER_SET,
  limit: 20,
  offset: 0,
  createdAt: new Date().toISOString(),
} as never;

describe("KnowledgeRankingEngine", () => {
  it("returns results unchanged when no strategy is requested", async () => {
    const engine = new KnowledgeRankingEngine(new KnowledgeRetrievalRegistry());
    const results = [{ assetId: "a-1" }] as never;
    expect(await engine.rank(results, query, contextFixture())).toBe(results);
  });

  it("dispatches to the registered provider for a requested strategy", async () => {
    const engine = new KnowledgeRankingEngine(new KnowledgeRetrievalRegistry());
    const ranked = [{ assetId: "ranked" }] as never;
    engine.register(KnowledgeRankingStrategy.BM25, { rank: async () => ranked });
    const results = await engine.rank([], query, contextFixture(), KnowledgeRankingStrategy.BM25);
    expect(results).toBe(ranked);
  });

  it("throws RankingNotSupportedException for an unregistered requested strategy", async () => {
    const engine = new KnowledgeRankingEngine(new KnowledgeRetrievalRegistry());
    await expect(
      engine.rank([], query, contextFixture(), KnowledgeRankingStrategy.BM25),
    ).rejects.toThrow(RankingNotSupportedException);
  });

  it("isSupported() reflects registration state", () => {
    const engine = new KnowledgeRankingEngine(new KnowledgeRetrievalRegistry());
    expect(engine.isSupported(KnowledgeRankingStrategy.HYBRID)).toBe(false);
    engine.register(KnowledgeRankingStrategy.HYBRID, { rank: async (results) => results });
    expect(engine.isSupported(KnowledgeRankingStrategy.HYBRID)).toBe(true);
  });
});
