import { describe, expect, it } from "vitest";

import { knowledgeQuerySessionRecordSchema } from "../../src/session/knowledge-query-session-record.js";
import { KnowledgeQuerySessionState } from "../../src/session/knowledge-query-session-state.js";

describe("knowledgeQuerySessionRecordSchema", () => {
  it("accepts the minimal required shape", () => {
    const record = knowledgeQuerySessionRecordSchema.parse({
      id: "s-1",
      token: "rtok_1",
      holder: "holder-1",
      state: KnowledgeQuerySessionState.OPEN,
      openedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:15:00.000Z",
    });
    expect(record.closedAt).toBeUndefined();
  });

  it("rejects a blank holder", () => {
    expect(() =>
      knowledgeQuerySessionRecordSchema.parse({
        id: "s-1",
        token: "rtok_1",
        holder: "",
        state: KnowledgeQuerySessionState.OPEN,
        openedAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-01T00:15:00.000Z",
      }),
    ).toThrow();
  });
});
