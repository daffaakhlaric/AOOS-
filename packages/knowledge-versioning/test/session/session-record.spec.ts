import { describe, expect, it } from "vitest";

import { knowledgeVersionSessionRecordSchema } from "../../src/session/knowledge-version-session-record.js";
import { KnowledgeVersionSessionState } from "../../src/session/knowledge-version-session-state.js";

describe("knowledgeVersionSessionRecordSchema", () => {
  it("parses a minimal valid record", () => {
    const record = {
      id: "s1",
      token: "kver_1",
      holder: "user-1",
      state: KnowledgeVersionSessionState.OPEN,
      openedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
    };
    expect(knowledgeVersionSessionRecordSchema.parse(record)).toEqual(record);
  });

  it("parses a record with optional closedAt/renewedAt", () => {
    const record = {
      id: "s1",
      token: "kver_1",
      holder: "user-1",
      state: KnowledgeVersionSessionState.CLOSED,
      openedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
      renewedAt: new Date().toISOString(),
    };
    expect(knowledgeVersionSessionRecordSchema.parse(record)).toEqual(record);
  });

  it("rejects an invalid state value", () => {
    expect(() =>
      knowledgeVersionSessionRecordSchema.parse({
        id: "s1",
        token: "kver_1",
        holder: "user-1",
        state: "bogus",
        openedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it("exposes the exact 4 KnowledgeVersionSessionStates", () => {
    expect(Object.values(KnowledgeVersionSessionState)).toHaveLength(4);
  });
});
