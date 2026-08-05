import { describe, expect, it } from "vitest";

import { knowledgeSourceSessionRecordSchema } from "../../src/session/knowledge-source-session-record.js";
import { KnowledgeSourceSessionState } from "../../src/session/knowledge-source-session-state.js";

describe("knowledgeSourceSessionRecordSchema", () => {
  it("accepts a minimal open record", () => {
    const now = new Date().toISOString();
    expect(() =>
      knowledgeSourceSessionRecordSchema.parse({
        id: "s-1",
        token: "tok-1",
        holder: "holder-1",
        state: KnowledgeSourceSessionState.OPEN,
        openedAt: now,
        expiresAt: now,
      }),
    ).not.toThrow();
  });
});
