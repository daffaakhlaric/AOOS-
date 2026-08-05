import { describe, expect, it } from "vitest";

import { KnowledgeProviderSessionState } from "../../src/session/knowledge-provider-session-state.js";

describe("KnowledgeProviderSessionState", () => {
  it("has exactly 4 states", () => {
    expect(Object.values(KnowledgeProviderSessionState)).toHaveLength(4);
  });

  it("includes OPEN, CLOSED, CANCELLED, EXPIRED", () => {
    expect(KnowledgeProviderSessionState.OPEN).toBe("open");
    expect(KnowledgeProviderSessionState.CLOSED).toBe("closed");
    expect(KnowledgeProviderSessionState.CANCELLED).toBe("cancelled");
    expect(KnowledgeProviderSessionState.EXPIRED).toBe("expired");
  });
});
