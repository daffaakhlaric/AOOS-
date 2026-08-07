import { describe, expect, it } from "vitest";

import { VersionLeaseException } from "../../src/errors/version-lease-exception.js";
import { VersionSessionException } from "../../src/errors/version-session-exception.js";
import { KnowledgeVersionSessionState } from "../../src/session/knowledge-version-session-state.js";
import { KnowledgeVersionSession } from "../../src/session/knowledge-version-session.js";

describe("KnowledgeVersionSession", () => {
  it("opens a session and reads it back", () => {
    const session = new KnowledgeVersionSession();
    const record = session.open("tok-1", "holder-1");
    expect(record.state).toBe(KnowledgeVersionSessionState.OPEN);
    expect(session.get("tok-1")).toEqual(record);
    expect(session.require("tok-1")).toEqual(record);
  });

  it("rejects opening a second session for the same token", () => {
    const session = new KnowledgeVersionSession();
    session.open("tok-1", "holder-1");
    expect(() => session.open("tok-1", "holder-2")).toThrow(VersionSessionException);
  });

  it("closes an open session", () => {
    const session = new KnowledgeVersionSession();
    session.open("tok-1", "holder-1");
    const closed = session.close("tok-1");
    expect(closed.state).toBe(KnowledgeVersionSessionState.CLOSED);
    expect(closed.closedAt).toBeTruthy();
  });

  it("rejects closing a session that is not open", () => {
    const session = new KnowledgeVersionSession();
    session.open("tok-1", "holder-1");
    session.close("tok-1");
    expect(() => session.close("tok-1")).toThrow(VersionSessionException);
  });

  it("cancels an open session", () => {
    const session = new KnowledgeVersionSession();
    session.open("tok-1", "holder-1");
    const cancelled = session.cancel("tok-1");
    expect(cancelled.state).toBe(KnowledgeVersionSessionState.CANCELLED);
  });

  it("expires a session regardless of current state", () => {
    const session = new KnowledgeVersionSession();
    session.open("tok-1", "holder-1");
    const expired = session.expire("tok-1");
    expect(expired.state).toBe(KnowledgeVersionSessionState.EXPIRED);
  });

  it("resumes a closed or expired session", () => {
    const session = new KnowledgeVersionSession();
    session.open("tok-1", "holder-1");
    session.close("tok-1");
    const resumed = session.resume("tok-1");
    expect(resumed.state).toBe(KnowledgeVersionSessionState.OPEN);
    expect(resumed.closedAt).toBeUndefined();
  });

  it("rejects resuming an already-open session", () => {
    const session = new KnowledgeVersionSession();
    session.open("tok-1", "holder-1");
    expect(() => session.resume("tok-1")).toThrow(VersionSessionException);
  });

  it("renews an open, unexpired session", () => {
    const session = new KnowledgeVersionSession();
    session.open("tok-1", "holder-1", 60_000);
    const renewed = session.renew("tok-1");
    expect(renewed.renewedAt).toBeTruthy();
  });

  it("rejects renewing an already-expired session", () => {
    const session = new KnowledgeVersionSession();
    session.open("tok-1", "holder-1", -1);
    expect(() => session.renew("tok-1")).toThrow(VersionLeaseException);
  });

  it("rejects renewing a session that is not open", () => {
    const session = new KnowledgeVersionSession();
    session.open("tok-1", "holder-1");
    session.close("tok-1");
    expect(() => session.renew("tok-1")).toThrow(VersionSessionException);
  });

  it("require() throws when no session is open for a token", () => {
    const session = new KnowledgeVersionSession();
    expect(() => session.require("missing")).toThrow(VersionSessionException);
  });

  it("get() returns undefined when no session is open for a token", () => {
    const session = new KnowledgeVersionSession();
    expect(session.get("missing")).toBeUndefined();
  });
});
