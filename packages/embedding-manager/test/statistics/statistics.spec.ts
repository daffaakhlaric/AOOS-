import { describe, expect, it } from "vitest";

import { EmbeddingProviderType } from "../../src/domain/embedding-provider-type.js";
import { EmbeddingStatistics } from "../../src/statistics/embedding-statistics.js";

describe("EmbeddingStatistics", () => {
  it("get() returns the empty snapshot for an unknown providerType", () => {
    const statistics = new EmbeddingStatistics();
    expect(statistics.get(EmbeddingProviderType.OPENAI)).toEqual({
      requestedCount: 0,
      completedCount: 0,
      failedCount: 0,
      cancelledCount: 0,
    });
  });

  it("recordRequested() increments requestedCount", () => {
    const statistics = new EmbeddingStatistics();
    statistics.recordRequested(EmbeddingProviderType.OPENAI);
    expect(statistics.get(EmbeddingProviderType.OPENAI).requestedCount).toBe(1);
  });

  it("recordCompleted() increments completedCount", () => {
    const statistics = new EmbeddingStatistics();
    statistics.recordCompleted(EmbeddingProviderType.OPENAI);
    expect(statistics.get(EmbeddingProviderType.OPENAI).completedCount).toBe(1);
  });

  it("recordFailed() increments failedCount", () => {
    const statistics = new EmbeddingStatistics();
    statistics.recordFailed(EmbeddingProviderType.OPENAI);
    expect(statistics.get(EmbeddingProviderType.OPENAI).failedCount).toBe(1);
  });

  it("recordCancelled() increments cancelledCount", () => {
    const statistics = new EmbeddingStatistics();
    statistics.recordCancelled(EmbeddingProviderType.OPENAI);
    expect(statistics.get(EmbeddingProviderType.OPENAI).cancelledCount).toBe(1);
  });

  it("keeps counters isolated per providerType", () => {
    const statistics = new EmbeddingStatistics();
    statistics.recordRequested(EmbeddingProviderType.OPENAI);
    statistics.recordRequested(EmbeddingProviderType.COHERE);
    expect(statistics.get(EmbeddingProviderType.OPENAI).requestedCount).toBe(1);
    expect(statistics.get(EmbeddingProviderType.COHERE).requestedCount).toBe(1);
  });

  it("stamps lastActivityAt on every write", () => {
    const statistics = new EmbeddingStatistics();
    const snapshot = statistics.recordRequested(EmbeddingProviderType.OPENAI);
    expect(snapshot.lastActivityAt).toBeDefined();
  });

  it("accumulates multiple counters independently", () => {
    const statistics = new EmbeddingStatistics();
    statistics.recordRequested(EmbeddingProviderType.OPENAI);
    statistics.recordCompleted(EmbeddingProviderType.OPENAI);
    const snapshot = statistics.get(EmbeddingProviderType.OPENAI);
    expect(snapshot.requestedCount).toBe(1);
    expect(snapshot.completedCount).toBe(1);
  });
});
