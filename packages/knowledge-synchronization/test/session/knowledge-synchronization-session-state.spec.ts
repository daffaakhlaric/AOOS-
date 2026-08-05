import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationSessionState } from "../../src/session/knowledge-synchronization-session-state.js";

describe("KnowledgeSynchronizationSessionState", () => {
  it("has exactly 4 states", () => {
    expect(Object.values(KnowledgeSynchronizationSessionState)).toHaveLength(4);
  });

  it("includes OPEN, CLOSED, CANCELLED, EXPIRED", () => {
    expect(KnowledgeSynchronizationSessionState.OPEN).toBe("open");
    expect(KnowledgeSynchronizationSessionState.CLOSED).toBe("closed");
    expect(KnowledgeSynchronizationSessionState.CANCELLED).toBe("cancelled");
    expect(KnowledgeSynchronizationSessionState.EXPIRED).toBe("expired");
  });
});
