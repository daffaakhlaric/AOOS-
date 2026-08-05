import { describe, expect, it, vi } from "vitest";

import { SourceLeaseException } from "../../src/errors/source-lease-exception.js";
import { SourceSessionException } from "../../src/errors/source-session-exception.js";
import { KnowledgeSourceSessionState } from "../../src/session/knowledge-source-session-state.js";
import { KnowledgeSourceSession } from "../../src/session/knowledge-source-session.js";

describe("KnowledgeSourceSession", () => {
  it("opens a session in OPEN state", () => {
    const session = new KnowledgeSourceSession();
    const record = session.open("tok-1", "holder-1");
    expect(record.state).toBe(KnowledgeSourceSessionState.OPEN);
    expect(record.token).toBe("tok-1");
  });

  it("throws when opening a token that is already open", () => {
    const session = new KnowledgeSourceSession();
    session.open("tok-1", "holder-1");
    expect(() => session.open("tok-1", "holder-1")).toThrow(SourceSessionException);
  });

  it("closes an open session", () => {
    const session = new KnowledgeSourceSession();
    session.open("tok-1", "holder-1");
    const closed = session.close("tok-1");
    expect(closed.state).toBe(KnowledgeSourceSessionState.CLOSED);
    expect(closed.closedAt).toBeDefined();
  });

  it("throws when closing a session that is not open", () => {
    const session = new KnowledgeSourceSession();
    session.open("tok-1", "holder-1");
    session.close("tok-1");
    expect(() => session.close("tok-1")).toThrow(SourceSessionException);
  });

  it("cancels an open session", () => {
    const session = new KnowledgeSourceSession();
    session.open("tok-1", "holder-1");
    const cancelled = session.cancel("tok-1");
    expect(cancelled.state).toBe(KnowledgeSourceSessionState.CANCELLED);
  });

  it("resumes a closed session", () => {
    const session = new KnowledgeSourceSession();
    session.open("tok-1", "holder-1");
    session.close("tok-1");
    const resumed = session.resume("tok-1");
    expect(resumed.state).toBe(KnowledgeSourceSessionState.OPEN);
    expect(resumed.closedAt).toBeUndefined();
  });

  it("resumes an expired session", () => {
    const session = new KnowledgeSourceSession();
    session.open("tok-1", "holder-1");
    session.expire("tok-1");
    const resumed = session.resume("tok-1");
    expect(resumed.state).toBe(KnowledgeSourceSessionState.OPEN);
  });

  it("throws when resuming a session that is still open", () => {
    const session = new KnowledgeSourceSession();
    session.open("tok-1", "holder-1");
    expect(() => session.resume("tok-1")).toThrow(SourceSessionException);
  });

  it("expires an open session", () => {
    const session = new KnowledgeSourceSession();
    session.open("tok-1", "holder-1");
    const expired = session.expire("tok-1");
    expect(expired.state).toBe(KnowledgeSourceSessionState.EXPIRED);
  });

  it("throws when expiring a session that was never opened", () => {
    const session = new KnowledgeSourceSession();
    expect(() => session.expire("missing")).toThrow(SourceSessionException);
  });

  it("renews an open, unexpired session", () => {
    const session = new KnowledgeSourceSession();
    session.open("tok-1", "holder-1", 60_000);
    const renewed = session.renew("tok-1");
    expect(renewed.renewedAt).toBeDefined();
  });

  it("throws SourceLeaseException when renewing an already-expired open session", () => {
    vi.useFakeTimers();
    try {
      const session = new KnowledgeSourceSession();
      session.open("tok-1", "holder-1", 10);
      vi.advanceTimersByTime(1000);
      expect(() => session.renew("tok-1")).toThrow(SourceLeaseException);
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws when renewing a session that is not open", () => {
    const session = new KnowledgeSourceSession();
    session.open("tok-1", "holder-1");
    session.close("tok-1");
    expect(() => session.renew("tok-1")).toThrow(SourceSessionException);
  });

  it("get returns undefined for a missing token", () => {
    const session = new KnowledgeSourceSession();
    expect(session.get("missing")).toBeUndefined();
  });

  it("require throws for a missing token", () => {
    const session = new KnowledgeSourceSession();
    expect(() => session.require("missing")).toThrow(SourceSessionException);
  });

  it("require returns the record for a known token", () => {
    const session = new KnowledgeSourceSession();
    session.open("tok-1", "holder-1");
    expect(session.require("tok-1").token).toBe("tok-1");
  });
});
