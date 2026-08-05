import { describe, expect, it } from "vitest";

import { KnowledgeSearchMode } from "../../src/domain/knowledge-search-mode.js";
import { KnowledgeRetrievalStatistics } from "../../src/statistics/knowledge-retrieval-statistics.js";

describe("KnowledgeRetrievalStatistics", () => {
  it("returns an empty snapshot for a mode never queried", () => {
    const statistics = new KnowledgeRetrievalStatistics();
    expect(statistics.get(KnowledgeSearchMode.KEYWORD)).toEqual({ queryCount: 0, resultCount: 0 });
  });

  it("accumulates queryCount/resultCount across recordQuery() calls", () => {
    const statistics = new KnowledgeRetrievalStatistics();
    statistics.recordQuery(KnowledgeSearchMode.KEYWORD, 3);
    statistics.recordQuery(KnowledgeSearchMode.KEYWORD, 2);
    const snapshot = statistics.get(KnowledgeSearchMode.KEYWORD);
    expect(snapshot.queryCount).toBe(2);
    expect(snapshot.resultCount).toBe(5);
    expect(snapshot.lastQueriedAt).toBeDefined();
  });

  it("tracks each Search Mode independently", () => {
    const statistics = new KnowledgeRetrievalStatistics();
    statistics.recordQuery(KnowledgeSearchMode.KEYWORD, 1);
    statistics.recordQuery(KnowledgeSearchMode.HYBRID, 5);
    expect(statistics.get(KnowledgeSearchMode.KEYWORD).resultCount).toBe(1);
    expect(statistics.get(KnowledgeSearchMode.HYBRID).resultCount).toBe(5);
  });
});
