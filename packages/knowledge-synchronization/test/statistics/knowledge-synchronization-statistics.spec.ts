import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationMode } from "../../src/domain/knowledge-synchronization-mode.js";
import { KnowledgeSynchronizationStatistics } from "../../src/statistics/knowledge-synchronization-statistics.js";

describe("KnowledgeSynchronizationStatistics", () => {
  it("returns an empty snapshot for a mode never synchronized", () => {
    const statistics = new KnowledgeSynchronizationStatistics();
    expect(statistics.get(KnowledgeSynchronizationMode.MANUAL)).toEqual({
      syncCount: 0,
      changeCount: 0,
    });
  });

  it("accumulates syncCount/changeCount across recordSynchronization() calls", () => {
    const statistics = new KnowledgeSynchronizationStatistics();
    statistics.recordSynchronization(KnowledgeSynchronizationMode.MANUAL, 3);
    statistics.recordSynchronization(KnowledgeSynchronizationMode.MANUAL, 2);
    const snapshot = statistics.get(KnowledgeSynchronizationMode.MANUAL);
    expect(snapshot.syncCount).toBe(2);
    expect(snapshot.changeCount).toBe(5);
    expect(snapshot.lastSyncedAt).toBeDefined();
  });

  it("tracks each Synchronization Mode independently", () => {
    const statistics = new KnowledgeSynchronizationStatistics();
    statistics.recordSynchronization(KnowledgeSynchronizationMode.MANUAL, 1);
    statistics.recordSynchronization(KnowledgeSynchronizationMode.FULL, 5);
    expect(statistics.get(KnowledgeSynchronizationMode.MANUAL).changeCount).toBe(1);
    expect(statistics.get(KnowledgeSynchronizationMode.FULL).changeCount).toBe(5);
  });
});
