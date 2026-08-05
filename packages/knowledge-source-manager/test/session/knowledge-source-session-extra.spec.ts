import { describe, expect, it } from "vitest";

import { KnowledgeSourceSession } from "../../src/session/knowledge-source-session.js";

describe("KnowledgeSourceSession additional coverage", () => {
  it("independent tokens do not interfere with each other", () => {
    const session = new KnowledgeSourceSession();
    session.open("tok-a", "holder-a");
    session.open("tok-b", "holder-b");
    session.close("tok-a");
    expect(session.require("tok-a").state).toBe("closed");
    expect(session.require("tok-b").state).toBe("open");
  });

  it("cancel() sets closedAt", () => {
    const session = new KnowledgeSourceSession();
    session.open("tok-1", "holder-1");
    const cancelled = session.cancel("tok-1");
    expect(cancelled.closedAt).toBeDefined();
  });

  it("a custom ttlMs is honored on open()", () => {
    const session = new KnowledgeSourceSession();
    const before = Date.now();
    const record = session.open("tok-1", "holder-1", 1000);
    expect(Date.parse(record.expiresAt) - before).toBeGreaterThanOrEqual(900);
  });
});
