import { describe, expect, it } from "vitest";

import {
  EMPTY_KNOWLEDGE_SOURCE_STATISTICS,
  knowledgeSourceStatisticsSnapshotSchema,
} from "../../src/domain/knowledge-source-statistics-snapshot.js";

describe("knowledgeSourceStatisticsSnapshotSchema", () => {
  it("accepts the empty snapshot constant", () => {
    expect(() =>
      knowledgeSourceStatisticsSnapshotSchema.parse(EMPTY_KNOWLEDGE_SOURCE_STATISTICS),
    ).not.toThrow();
  });

  it("starts registrationCount/usageCount at 0", () => {
    expect(EMPTY_KNOWLEDGE_SOURCE_STATISTICS.registrationCount).toBe(0);
    expect(EMPTY_KNOWLEDGE_SOURCE_STATISTICS.usageCount).toBe(0);
  });
});
