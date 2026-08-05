import { describe, expect, it } from "vitest";

import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import { KnowledgeIndexStatistics } from "../../src/statistics/knowledge-index-statistics.js";

describe("Statistics Test — KnowledgeIndexStatistics", () => {
  it("get() returns EMPTY_KNOWLEDGE_INDEX_STATISTICS before anything is recorded", () => {
    const statistics = new KnowledgeIndexStatistics(new KnowledgeIndexRegistry());
    expect(statistics.get(KnowledgeIndexType.KEYWORD).entryCount).toBe(0);
  });

  it("recordBuilt() increments entryCount and stamps lastBuiltAt", () => {
    const statistics = new KnowledgeIndexStatistics(new KnowledgeIndexRegistry());
    statistics.recordBuilt(KnowledgeIndexType.KEYWORD, 3);
    const snapshot = statistics.get(KnowledgeIndexType.KEYWORD);
    expect(snapshot.entryCount).toBe(3);
    expect(snapshot.lastBuiltAt).toBeTruthy();
  });

  it("recordRemoved() decrements entryCount, never below zero", () => {
    const statistics = new KnowledgeIndexStatistics(new KnowledgeIndexRegistry());
    statistics.recordBuilt(KnowledgeIndexType.KEYWORD, 1);
    statistics.recordRemoved(KnowledgeIndexType.KEYWORD, 5);
    expect(statistics.get(KnowledgeIndexType.KEYWORD).entryCount).toBe(0);
  });

  it("recordOptimized()/recordRebuilt() stamp their respective timestamps", () => {
    const statistics = new KnowledgeIndexStatistics(new KnowledgeIndexRegistry());
    statistics.recordOptimized(KnowledgeIndexType.KEYWORD);
    statistics.recordRebuilt(KnowledgeIndexType.KEYWORD);
    const snapshot = statistics.get(KnowledgeIndexType.KEYWORD);
    expect(snapshot.lastOptimizedAt).toBeTruthy();
    expect(snapshot.lastRebuiltAt).toBeTruthy();
  });

  it("tracks Statistics independently per KnowledgeIndexType", () => {
    const statistics = new KnowledgeIndexStatistics(new KnowledgeIndexRegistry());
    statistics.recordBuilt(KnowledgeIndexType.KEYWORD, 2);
    statistics.recordBuilt(KnowledgeIndexType.TAG, 5);
    expect(statistics.get(KnowledgeIndexType.KEYWORD).entryCount).toBe(2);
    expect(statistics.get(KnowledgeIndexType.TAG).entryCount).toBe(5);
  });
});
