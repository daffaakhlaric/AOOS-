import { describe, expect, it } from "vitest";

import {
  knowledgeRetrievalHistoryEntrySchema,
  knowledgeRetrievalHistorySchema,
} from "../../src/domain/knowledge-retrieval-history.js";
import { KnowledgeRetrievalState } from "../../src/domain/knowledge-retrieval-state.js";

describe("knowledgeRetrievalHistoryEntrySchema", () => {
  it("accepts an entry without a reason", () => {
    const entry = knowledgeRetrievalHistoryEntrySchema.parse({
      sequence: 0,
      fromState: KnowledgeRetrievalState.CREATED,
      toState: KnowledgeRetrievalState.VALIDATING,
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    expect(entry.reason).toBeUndefined();
  });

  it("accepts an entry with a reason", () => {
    const entry = knowledgeRetrievalHistoryEntrySchema.parse({
      sequence: 1,
      fromState: KnowledgeRetrievalState.VALIDATING,
      toState: KnowledgeRetrievalState.FAILED,
      occurredAt: "2026-01-01T00:00:00.000Z",
      reason: "validation failed",
    });
    expect(entry.reason).toBe("validation failed");
  });

  it("rejects a negative sequence", () => {
    expect(() =>
      knowledgeRetrievalHistoryEntrySchema.parse({
        sequence: -1,
        fromState: KnowledgeRetrievalState.CREATED,
        toState: KnowledgeRetrievalState.VALIDATING,
        occurredAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("knowledgeRetrievalHistorySchema", () => {
  it("accepts an array of entries", () => {
    const history = knowledgeRetrievalHistorySchema.parse([
      {
        sequence: 0,
        fromState: KnowledgeRetrievalState.CREATED,
        toState: KnowledgeRetrievalState.VALIDATING,
        occurredAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(history).toHaveLength(1);
  });

  it("accepts an empty array", () => {
    expect(knowledgeRetrievalHistorySchema.parse([])).toEqual([]);
  });
});
