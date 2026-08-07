import { describe, expect, it } from "vitest";

import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";
import { SessionNotFoundException } from "../../src/errors/session-not-found-exception.js";

describe("SessionNotFoundException", () => {
  it("is a KnowledgeAutoUpdateException", () => {
    expect(new SessionNotFoundException("s-1")).toBeInstanceOf(KnowledgeAutoUpdateException);
  });

  it("sets code SESSION_NOT_FOUND", () => {
    expect(new SessionNotFoundException("s-1").code).toBe("SESSION_NOT_FOUND");
  });

  it("includes the session id in message and context", () => {
    const error = new SessionNotFoundException("s-7");
    expect(error.message).toContain("s-7");
    expect(error.context).toEqual({ sessionId: "s-7" });
  });
});
