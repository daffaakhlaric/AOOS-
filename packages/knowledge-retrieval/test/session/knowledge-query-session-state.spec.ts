import { describe, expect, it } from "vitest";

import { KnowledgeQuerySessionState } from "../../src/session/knowledge-query-session-state.js";

describe("KnowledgeQuerySessionState", () => {
  it("has exactly 4 states", () => {
    expect(Object.values(KnowledgeQuerySessionState)).toHaveLength(4);
  });

  it("includes OPEN, CLOSED, CANCELLED, EXPIRED", () => {
    expect(KnowledgeQuerySessionState.OPEN).toBe("open");
    expect(KnowledgeQuerySessionState.CLOSED).toBe("closed");
    expect(KnowledgeQuerySessionState.CANCELLED).toBe("cancelled");
    expect(KnowledgeQuerySessionState.EXPIRED).toBe("expired");
  });
});
