import { describe, expect, it } from "vitest";

import {
  EMPTY_KNOWLEDGE_SYNCHRONIZATION_STATISTICS,
  knowledgeSynchronizationStatisticsSnapshotSchema,
} from "../../src/domain/knowledge-synchronization-statistics-snapshot.js";

describe("knowledgeSynchronizationStatisticsSnapshotSchema", () => {
  it("accepts a snapshot without lastSyncedAt", () => {
    const snapshot = knowledgeSynchronizationStatisticsSnapshotSchema.parse({
      syncCount: 2,
      changeCount: 4,
    });
    expect(snapshot.lastSyncedAt).toBeUndefined();
  });

  it("rejects a negative syncCount", () => {
    expect(() =>
      knowledgeSynchronizationStatisticsSnapshotSchema.parse({ syncCount: -1, changeCount: 0 }),
    ).toThrow();
  });
});

describe("EMPTY_KNOWLEDGE_SYNCHRONIZATION_STATISTICS", () => {
  it("starts at zero counts", () => {
    expect(EMPTY_KNOWLEDGE_SYNCHRONIZATION_STATISTICS).toEqual({ syncCount: 0, changeCount: 0 });
  });
});
