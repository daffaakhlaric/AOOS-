import { describe, expect, it } from "vitest";

import {
  knowledgeProviderHistoryEntrySchema,
  knowledgeProviderHistorySchema,
} from "../../src/domain/knowledge-provider-history.js";
import { KnowledgeProviderState } from "../../src/domain/knowledge-provider-state.js";

describe("knowledgeProviderHistoryEntrySchema", () => {
  it("accepts an entry without a reason", () => {
    const entry = knowledgeProviderHistoryEntrySchema.parse({
      sequence: 0,
      fromState: KnowledgeProviderState.REGISTERED,
      toState: KnowledgeProviderState.VALIDATED,
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    expect(entry.reason).toBeUndefined();
  });

  it("accepts an entry with a reason", () => {
    const entry = knowledgeProviderHistoryEntrySchema.parse({
      sequence: 1,
      fromState: KnowledgeProviderState.VALIDATED,
      toState: KnowledgeProviderState.FAILED,
      occurredAt: "2026-01-01T00:00:00.000Z",
      reason: "boom",
    });
    expect(entry.reason).toBe("boom");
  });

  it("rejects a negative sequence", () => {
    expect(() =>
      knowledgeProviderHistoryEntrySchema.parse({
        sequence: -1,
        fromState: KnowledgeProviderState.REGISTERED,
        toState: KnowledgeProviderState.VALIDATED,
        occurredAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("knowledgeProviderHistorySchema", () => {
  it("accepts an array of entries", () => {
    const history = knowledgeProviderHistorySchema.parse([
      {
        sequence: 0,
        fromState: KnowledgeProviderState.REGISTERED,
        toState: KnowledgeProviderState.VALIDATED,
        occurredAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(history).toHaveLength(1);
  });

  it("accepts an empty array", () => {
    expect(knowledgeProviderHistorySchema.parse([])).toEqual([]);
  });
});
