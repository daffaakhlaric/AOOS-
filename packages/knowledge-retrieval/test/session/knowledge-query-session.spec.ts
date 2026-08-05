import { describe, expect, it } from "vitest";

import { RetrievalLeaseException } from "../../src/errors/retrieval-lease-exception.js";
import { RetrievalSessionException } from "../../src/errors/retrieval-session-exception.js";
import { KnowledgeQuerySessionState } from "../../src/session/knowledge-query-session-state.js";
import { KnowledgeQuerySession } from "../../src/session/knowledge-query-session.js";

describe("KnowledgeQuerySession", () => {
  it("opens a new session in the OPEN state", () => {
    const session = new KnowledgeQuerySession();
    const record = session.open("rtok_1", "holder-1");
    expect(record.state).toBe(KnowledgeQuerySessionState.OPEN);
    expect(record.holder).toBe("holder-1");
  });

  it("throws when opening a session for a token already open", () => {
    const session = new KnowledgeQuerySession();
    session.open("rtok_1", "holder-1");
    expect(() => session.open("rtok_1", "holder-1")).toThrow(RetrievalSessionException);
  });

  it("closes an open session", () => {
    const session = new KnowledgeQuerySession();
    session.open("rtok_1", "holder-1");
    const closed = session.close("rtok_1");
    expect(closed.state).toBe(KnowledgeQuerySessionState.CLOSED);
    expect(closed.closedAt).toBeDefined();
  });

  it("throws when closing a session that is not open", () => {
    const session = new KnowledgeQuerySession();
    session.open("rtok_1", "holder-1");
    session.close("rtok_1");
    expect(() => session.close("rtok_1")).toThrow(RetrievalSessionException);
  });

  it("cancels an open session", () => {
    const session = new KnowledgeQuerySession();
    session.open("rtok_1", "holder-1");
    const cancelled = session.cancel("rtok_1");
    expect(cancelled.state).toBe(KnowledgeQuerySessionState.CANCELLED);
  });

  it("expires a session regardless of its current state", () => {
    const session = new KnowledgeQuerySession();
    session.open("rtok_1", "holder-1");
    const expired = session.expire("rtok_1");
    expect(expired.state).toBe(KnowledgeQuerySessionState.EXPIRED);
  });

  it("resumes a closed session back to OPEN", () => {
    const session = new KnowledgeQuerySession();
    session.open("rtok_1", "holder-1");
    session.close("rtok_1");
    const resumed = session.resume("rtok_1");
    expect(resumed.state).toBe(KnowledgeQuerySessionState.OPEN);
    expect(resumed.closedAt).toBeUndefined();
  });

  it("resumes an expired session back to OPEN", () => {
    const session = new KnowledgeQuerySession();
    session.open("rtok_1", "holder-1");
    session.expire("rtok_1");
    const resumed = session.resume("rtok_1");
    expect(resumed.state).toBe(KnowledgeQuerySessionState.OPEN);
  });

  it("throws resuming a session that is currently open", () => {
    const session = new KnowledgeQuerySession();
    session.open("rtok_1", "holder-1");
    expect(() => session.resume("rtok_1")).toThrow(RetrievalSessionException);
  });

  it("renews an open session's expiry", () => {
    const session = new KnowledgeQuerySession();
    session.open("rtok_1", "holder-1");
    const renewed = session.renew("rtok_1");
    expect(renewed.renewedAt).toBeDefined();
  });

  it("throws renewing an already-expired session's lease", () => {
    const session = new KnowledgeQuerySession();
    session.open("rtok_1", "holder-1", -1);
    expect(() => session.renew("rtok_1")).toThrow(RetrievalLeaseException);
  });

  it("throws requiring a session for an unknown token", () => {
    const session = new KnowledgeQuerySession();
    expect(() => session.require("rtok_missing")).toThrow(RetrievalSessionException);
  });

  it("get() returns undefined for an unknown token", () => {
    const session = new KnowledgeQuerySession();
    expect(session.get("rtok_missing")).toBeUndefined();
  });

  it("get() returns the record for a known token", () => {
    const session = new KnowledgeQuerySession();
    session.open("rtok_1", "holder-1");
    expect(session.get("rtok_1")).toBeDefined();
  });
});
