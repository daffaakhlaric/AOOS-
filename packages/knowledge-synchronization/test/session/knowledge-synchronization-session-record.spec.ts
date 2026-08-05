import { describe, expect, it } from "vitest";

import { knowledgeSynchronizationSessionRecordSchema } from "../../src/session/knowledge-synchronization-session-record.js";
import { KnowledgeSynchronizationSessionState } from "../../src/session/knowledge-synchronization-session-state.js";

describe("knowledgeSynchronizationSessionRecordSchema", () => {
  it("accepts the minimal required shape", () => {
    const record = knowledgeSynchronizationSessionRecordSchema.parse({
      id: "s-1",
      token: "stok_1",
      holder: "holder-1",
      state: KnowledgeSynchronizationSessionState.OPEN,
      openedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:15:00.000Z",
    });
    expect(record.closedAt).toBeUndefined();
  });

  it("rejects a blank holder", () => {
    expect(() =>
      knowledgeSynchronizationSessionRecordSchema.parse({
        id: "s-1",
        token: "stok_1",
        holder: "",
        state: KnowledgeSynchronizationSessionState.OPEN,
        openedAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-01T00:15:00.000Z",
      }),
    ).toThrow();
  });
});
