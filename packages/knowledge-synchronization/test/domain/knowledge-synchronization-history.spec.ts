import { describe, expect, it } from "vitest";

import {
  knowledgeSynchronizationHistoryEntrySchema,
  knowledgeSynchronizationHistorySchema,
} from "../../src/domain/knowledge-synchronization-history.js";
import { KnowledgeSynchronizationState } from "../../src/domain/knowledge-synchronization-state.js";

describe("knowledgeSynchronizationHistoryEntrySchema", () => {
  it("accepts an entry without a reason", () => {
    const entry = knowledgeSynchronizationHistoryEntrySchema.parse({
      sequence: 0,
      fromState: KnowledgeSynchronizationState.CREATED,
      toState: KnowledgeSynchronizationState.QUEUED,
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    expect(entry.reason).toBeUndefined();
  });

  it("accepts an entry with a reason", () => {
    const entry = knowledgeSynchronizationHistoryEntrySchema.parse({
      sequence: 1,
      fromState: KnowledgeSynchronizationState.QUEUED,
      toState: KnowledgeSynchronizationState.FAILED,
      occurredAt: "2026-01-01T00:00:00.000Z",
      reason: "boom",
    });
    expect(entry.reason).toBe("boom");
  });

  it("rejects a negative sequence", () => {
    expect(() =>
      knowledgeSynchronizationHistoryEntrySchema.parse({
        sequence: -1,
        fromState: KnowledgeSynchronizationState.CREATED,
        toState: KnowledgeSynchronizationState.QUEUED,
        occurredAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("knowledgeSynchronizationHistorySchema", () => {
  it("accepts an array of entries", () => {
    const history = knowledgeSynchronizationHistorySchema.parse([
      {
        sequence: 0,
        fromState: KnowledgeSynchronizationState.CREATED,
        toState: KnowledgeSynchronizationState.QUEUED,
        occurredAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(history).toHaveLength(1);
  });

  it("accepts an empty array", () => {
    expect(knowledgeSynchronizationHistorySchema.parse([])).toEqual([]);
  });
});
