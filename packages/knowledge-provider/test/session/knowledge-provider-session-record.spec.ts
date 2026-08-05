import { describe, expect, it } from "vitest";

import { knowledgeProviderSessionRecordSchema } from "../../src/session/knowledge-provider-session-record.js";
import { KnowledgeProviderSessionState } from "../../src/session/knowledge-provider-session-state.js";

describe("knowledgeProviderSessionRecordSchema", () => {
  it("accepts the minimal required shape", () => {
    const record = knowledgeProviderSessionRecordSchema.parse({
      id: "s-1",
      token: "ptok_1",
      holder: "holder-1",
      state: KnowledgeProviderSessionState.OPEN,
      openedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:15:00.000Z",
    });
    expect(record.closedAt).toBeUndefined();
  });

  it("rejects a blank holder", () => {
    expect(() =>
      knowledgeProviderSessionRecordSchema.parse({
        id: "s-1",
        token: "ptok_1",
        holder: "",
        state: KnowledgeProviderSessionState.OPEN,
        openedAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-01T00:15:00.000Z",
      }),
    ).toThrow();
  });
});
