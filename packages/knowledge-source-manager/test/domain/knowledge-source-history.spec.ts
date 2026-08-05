import { describe, expect, it } from "vitest";

import { knowledgeSourceHistoryEntrySchema } from "../../src/domain/knowledge-source-history.js";
import { KnowledgeSourceState } from "../../src/domain/knowledge-source-state.js";

describe("knowledgeSourceHistoryEntrySchema", () => {
  it("accepts a well-formed entry without a reason", () => {
    expect(() =>
      knowledgeSourceHistoryEntrySchema.parse({
        sequence: 0,
        fromState: KnowledgeSourceState.CREATED,
        toState: KnowledgeSourceState.REGISTERED,
        occurredAt: new Date().toISOString(),
      }),
    ).not.toThrow();
  });

  it("accepts a well-formed entry with a reason", () => {
    expect(() =>
      knowledgeSourceHistoryEntrySchema.parse({
        sequence: 1,
        fromState: KnowledgeSourceState.REGISTERED,
        toState: KnowledgeSourceState.CONFIGURED,
        occurredAt: new Date().toISOString(),
        reason: "manual",
      }),
    ).not.toThrow();
  });

  it("rejects a negative sequence", () => {
    expect(() =>
      knowledgeSourceHistoryEntrySchema.parse({
        sequence: -1,
        fromState: KnowledgeSourceState.CREATED,
        toState: KnowledgeSourceState.REGISTERED,
        occurredAt: new Date().toISOString(),
      }),
    ).toThrow();
  });
});
