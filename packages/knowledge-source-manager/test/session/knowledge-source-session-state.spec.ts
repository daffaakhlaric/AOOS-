import { describe, expect, it } from "vitest";

import { KnowledgeSourceSessionState } from "../../src/session/knowledge-source-session-state.js";

describe("KnowledgeSourceSessionState", () => {
  it("has exactly 4 states", () => {
    expect(Object.values(KnowledgeSourceSessionState)).toEqual([
      "open",
      "closed",
      "cancelled",
      "expired",
    ]);
  });
});
