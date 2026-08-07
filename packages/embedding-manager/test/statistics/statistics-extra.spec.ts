import { describe, expect, it } from "vitest";

import { EmbeddingProviderType } from "../../src/domain/embedding-provider-type.js";
import { EmbeddingStatistics } from "../../src/statistics/embedding-statistics.js";

describe("EmbeddingStatistics — per-ProviderType isolation across all 8 types", () => {
  it.each(Object.values(EmbeddingProviderType))(
    "tracks requested/completed/failed/cancelled independently for %s",
    (providerType) => {
      const statistics = new EmbeddingStatistics();
      statistics.recordRequested(providerType);
      statistics.recordRequested(providerType);
      statistics.recordCompleted(providerType);
      statistics.recordFailed(providerType);
      statistics.recordCancelled(providerType);
      const snapshot = statistics.get(providerType);
      expect(snapshot.requestedCount).toBe(2);
      expect(snapshot.completedCount).toBe(1);
      expect(snapshot.failedCount).toBe(1);
      expect(snapshot.cancelledCount).toBe(1);
    },
  );

  it("does not leak counters between two different provider types", () => {
    const statistics = new EmbeddingStatistics();
    statistics.recordRequested(EmbeddingProviderType.OPENAI);
    expect(statistics.get(EmbeddingProviderType.GEMINI).requestedCount).toBe(0);
  });
});
