import { describe, expect, it } from "vitest";

import { knowledgePolicySessionRecordSchema } from "../../src/session/knowledge-policy-session-record.js";
import { KnowledgePolicySessionState } from "../../src/session/knowledge-policy-session-state.js";

describe("knowledgePolicySessionRecordSchema", () => {
  it("accepts a well-formed open session record", () => {
    const result = knowledgePolicySessionRecordSchema.safeParse({
      id: "session-1",
      token: "kpol_1",
      holder: "holder-1",
      state: KnowledgePolicySessionState.OPEN,
      openedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:15:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional closedAt/renewedAt", () => {
    const result = knowledgePolicySessionRecordSchema.safeParse({
      id: "session-1",
      token: "kpol_1",
      holder: "holder-1",
      state: KnowledgePolicySessionState.CLOSED,
      openedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:15:00.000Z",
      closedAt: "2026-01-01T00:10:00.000Z",
      renewedAt: "2026-01-01T00:05:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid state", () => {
    const result = knowledgePolicySessionRecordSchema.safeParse({
      id: "session-1",
      token: "kpol_1",
      holder: "holder-1",
      state: "bogus",
      openedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:15:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a blank holder", () => {
    const result = knowledgePolicySessionRecordSchema.safeParse({
      id: "session-1",
      token: "kpol_1",
      holder: "",
      state: KnowledgePolicySessionState.OPEN,
      openedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:15:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("has exactly 4 KnowledgePolicySessionState members", () => {
    expect(Object.values(KnowledgePolicySessionState)).toHaveLength(4);
  });
});
