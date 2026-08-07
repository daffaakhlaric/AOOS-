import { describe, expect, it } from "vitest";

import { KnowledgeGenerationAssetType } from "../../src/domain/knowledge-generation-asset-type.js";
import { KnowledgeGeneratorStatistics } from "../../src/statistics/knowledge-generator-statistics.js";

describe("KnowledgeGeneratorStatistics", () => {
  it("returns the empty snapshot for an untouched Asset Type", () => {
    const statistics = new KnowledgeGeneratorStatistics();
    expect(statistics.get(KnowledgeGenerationAssetType.FAQ)).toEqual({
      requestedCount: 0,
      completedCount: 0,
      failedCount: 0,
    });
  });

  it("recordRequested() increments requestedCount", () => {
    const statistics = new KnowledgeGeneratorStatistics();
    statistics.recordRequested(KnowledgeGenerationAssetType.FAQ);
    statistics.recordRequested(KnowledgeGenerationAssetType.FAQ);
    expect(statistics.get(KnowledgeGenerationAssetType.FAQ).requestedCount).toBe(2);
  });

  it("recordCompleted() increments completedCount", () => {
    const statistics = new KnowledgeGeneratorStatistics();
    statistics.recordCompleted(KnowledgeGenerationAssetType.SOP);
    expect(statistics.get(KnowledgeGenerationAssetType.SOP).completedCount).toBe(1);
  });

  it("recordFailed() increments failedCount", () => {
    const statistics = new KnowledgeGeneratorStatistics();
    statistics.recordFailed(KnowledgeGenerationAssetType.SOP);
    expect(statistics.get(KnowledgeGenerationAssetType.SOP).failedCount).toBe(1);
  });

  it("keeps Asset Types independent", () => {
    const statistics = new KnowledgeGeneratorStatistics();
    statistics.recordRequested(KnowledgeGenerationAssetType.FAQ);
    expect(statistics.get(KnowledgeGenerationAssetType.SOP).requestedCount).toBe(0);
  });

  it("stamps lastActivityAt on every mutation", () => {
    const statistics = new KnowledgeGeneratorStatistics();
    const snapshot = statistics.recordRequested(KnowledgeGenerationAssetType.FAQ);
    expect(snapshot.lastActivityAt).toBeDefined();
  });
});
