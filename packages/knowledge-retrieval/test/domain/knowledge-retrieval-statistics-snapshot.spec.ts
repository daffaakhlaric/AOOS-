import { describe, expect, it } from "vitest";

import {
  EMPTY_KNOWLEDGE_RETRIEVAL_STATISTICS,
  knowledgeRetrievalStatisticsSnapshotSchema,
} from "../../src/domain/knowledge-retrieval-statistics-snapshot.js";

describe("knowledgeRetrievalStatisticsSnapshotSchema", () => {
  it("accepts a snapshot without lastQueriedAt", () => {
    const snapshot = knowledgeRetrievalStatisticsSnapshotSchema.parse({
      queryCount: 3,
      resultCount: 10,
    });
    expect(snapshot.lastQueriedAt).toBeUndefined();
  });

  it("rejects a negative queryCount", () => {
    expect(() =>
      knowledgeRetrievalStatisticsSnapshotSchema.parse({ queryCount: -1, resultCount: 0 }),
    ).toThrow();
  });
});

describe("EMPTY_KNOWLEDGE_RETRIEVAL_STATISTICS", () => {
  it("starts at zero counts", () => {
    expect(EMPTY_KNOWLEDGE_RETRIEVAL_STATISTICS).toEqual({ queryCount: 0, resultCount: 0 });
  });
});
