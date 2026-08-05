import { describe, expect, it } from "vitest";

import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import { KnowledgeIndexStatistics } from "../../src/statistics/knowledge-index-statistics.js";

describe("Statistics Test — edge cases", () => {
  it("recordBuilt() defaults count to 1 when omitted", () => {
    const statistics = new KnowledgeIndexStatistics(new KnowledgeIndexRegistry());
    statistics.recordBuilt(KnowledgeIndexType.KEYWORD);
    expect(statistics.get(KnowledgeIndexType.KEYWORD).entryCount).toBe(1);
  });

  it("recordRemoved() defaults count to 1 when omitted", () => {
    const statistics = new KnowledgeIndexStatistics(new KnowledgeIndexRegistry());
    statistics.recordBuilt(KnowledgeIndexType.KEYWORD, 2);
    statistics.recordRemoved(KnowledgeIndexType.KEYWORD);
    expect(statistics.get(KnowledgeIndexType.KEYWORD).entryCount).toBe(1);
  });

  it("recordOptimized() preserves the existing entryCount", () => {
    const statistics = new KnowledgeIndexStatistics(new KnowledgeIndexRegistry());
    statistics.recordBuilt(KnowledgeIndexType.KEYWORD, 4);
    statistics.recordOptimized(KnowledgeIndexType.KEYWORD);
    expect(statistics.get(KnowledgeIndexType.KEYWORD).entryCount).toBe(4);
  });

  it("recordRebuilt() preserves the existing entryCount", () => {
    const statistics = new KnowledgeIndexStatistics(new KnowledgeIndexRegistry());
    statistics.recordBuilt(KnowledgeIndexType.KEYWORD, 4);
    statistics.recordRebuilt(KnowledgeIndexType.KEYWORD);
    expect(statistics.get(KnowledgeIndexType.KEYWORD).entryCount).toBe(4);
  });
});
