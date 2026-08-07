import { describe, expect, it } from "vitest";

import { EmbeddingSession } from "../../src/session/embedding-session.js";

describe("EmbeddingSession — extra scenarios", () => {
  it("supports many independent sessions keyed by distinct tokens", () => {
    const session = new EmbeddingSession();
    session.open("tok-a", "user-a");
    session.open("tok-b", "user-b");
    expect(session.require("tok-a").holder).toBe("user-a");
    expect(session.require("tok-b").holder).toBe("user-b");
  });

  it("closing one session does not affect another", () => {
    const session = new EmbeddingSession();
    session.open("tok-a", "user-a");
    session.open("tok-b", "user-b");
    session.close("tok-a");
    expect(session.require("tok-b").state).toBe("open");
  });

  it("default TTL keeps the session open immediately after opening", () => {
    const session = new EmbeddingSession();
    const record = session.open("tok-a", "user-a");
    expect(Date.parse(record.expiresAt) > Date.now()).toBe(true);
  });

  it("a very short TTL still returns a well-formed record", () => {
    const session = new EmbeddingSession();
    const record = session.open("tok-a", "user-a", 1);
    expect(record.state).toBe("open");
  });

  it("resume() after cancel() still throws (cancel is not a resumable state)", () => {
    const session = new EmbeddingSession();
    session.open("tok-a", "user-a");
    session.cancel("tok-a");
    expect(() => session.resume("tok-a")).toThrow();
  });

  it("renew() twice in a row keeps extending expiresAt", () => {
    const session = new EmbeddingSession();
    session.open("tok-a", "user-a", 10_000);
    const first = session.renew("tok-a", 20_000);
    const second = session.renew("tok-a", 30_000);
    expect(Date.parse(second.expiresAt)).toBeGreaterThanOrEqual(Date.parse(first.expiresAt));
  });
});
