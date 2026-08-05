import { describe, expect, it } from "vitest";

import { RuntimeSessionException } from "../../src/errors/runtime-session-exception.js";
import { KnowledgeRuntimeSession } from "../../src/session/knowledge-runtime-session.js";

describe("Session Test — edge cases", () => {
  it("renew() throws RuntimeSessionException for a CLOSED Session", () => {
    const session = new KnowledgeRuntimeSession();
    session.open("ktok_1", "user-1");
    session.close("ktok_1");
    expect(() => session.renew("ktok_1")).toThrow(RuntimeSessionException);
  });

  it("resume() throws RuntimeSessionException for a Session that is not SUSPENDED", () => {
    const session = new KnowledgeRuntimeSession();
    session.open("ktok_1", "user-1");
    expect(() => session.resume("ktok_1")).toThrow(RuntimeSessionException);
  });

  it("expire() works from any known Session state", () => {
    const session = new KnowledgeRuntimeSession();
    session.open("ktok_1", "user-1");
    session.suspend("ktok_1");
    const expired = session.expire("ktok_1");
    expect(expired.state).toBe("expired");
  });
});
