import { describe, expect, it } from "vitest";

import {
  EMPTY_KNOWLEDGE_PROVIDER_STATISTICS,
  knowledgeProviderStatisticsSnapshotSchema,
} from "../../src/domain/knowledge-provider-statistics-snapshot.js";

describe("knowledgeProviderStatisticsSnapshotSchema", () => {
  it("accepts a snapshot without lastUsedAt", () => {
    const snapshot = knowledgeProviderStatisticsSnapshotSchema.parse({
      registrationCount: 2,
      usageCount: 5,
    });
    expect(snapshot.lastUsedAt).toBeUndefined();
  });

  it("rejects a negative registrationCount", () => {
    expect(() =>
      knowledgeProviderStatisticsSnapshotSchema.parse({ registrationCount: -1, usageCount: 0 }),
    ).toThrow();
  });
});

describe("EMPTY_KNOWLEDGE_PROVIDER_STATISTICS", () => {
  it("starts at zero counts", () => {
    expect(EMPTY_KNOWLEDGE_PROVIDER_STATISTICS).toEqual({ registrationCount: 0, usageCount: 0 });
  });
});
