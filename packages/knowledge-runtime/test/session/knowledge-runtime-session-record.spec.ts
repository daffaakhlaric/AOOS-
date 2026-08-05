import { describe, expect, it } from "vitest";

import { knowledgeRuntimeSessionRecordSchema } from "../../src/session/knowledge-runtime-session-record.js";
import { KnowledgeRuntimeSessionState } from "../../src/session/knowledge-runtime-session-state.js";

describe("Session Test — knowledgeRuntimeSessionRecordSchema", () => {
  it("accepts a valid Session record", () => {
    const now = new Date().toISOString();
    const result = knowledgeRuntimeSessionRecordSchema.safeParse({
      id: "s-1",
      instanceToken: "ktok_1",
      state: KnowledgeRuntimeSessionState.OPEN,
      lease: { id: "l-1", token: "ktok_1", holder: "user-1", acquiredAt: now, expiresAt: now },
      openedAt: now,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing instanceToken", () => {
    const now = new Date().toISOString();
    const result = knowledgeRuntimeSessionRecordSchema.safeParse({
      id: "s-1",
      state: KnowledgeRuntimeSessionState.OPEN,
      lease: { id: "l-1", token: "ktok_1", holder: "user-1", acquiredAt: now, expiresAt: now },
      openedAt: now,
    });
    expect(result.success).toBe(false);
  });
});
