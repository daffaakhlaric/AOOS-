import { describe, expect, it } from "vitest";

import { SynchronizationLeaseException } from "../../src/errors/synchronization-lease-exception.js";
import { SynchronizationSessionException } from "../../src/errors/synchronization-session-exception.js";
import { KnowledgeSynchronizationSessionState } from "../../src/session/knowledge-synchronization-session-state.js";
import { KnowledgeSynchronizationSession } from "../../src/session/knowledge-synchronization-session.js";

describe("KnowledgeSynchronizationSession", () => {
  it("opens a new session in the OPEN state", () => {
    const session = new KnowledgeSynchronizationSession();
    const record = session.open("stok_1", "holder-1");
    expect(record.state).toBe(KnowledgeSynchronizationSessionState.OPEN);
    expect(record.holder).toBe("holder-1");
  });

  it("throws when opening a session for a token already open", () => {
    const session = new KnowledgeSynchronizationSession();
    session.open("stok_1", "holder-1");
    expect(() => session.open("stok_1", "holder-1")).toThrow(SynchronizationSessionException);
  });

  it("closes an open session", () => {
    const session = new KnowledgeSynchronizationSession();
    session.open("stok_1", "holder-1");
    const closed = session.close("stok_1");
    expect(closed.state).toBe(KnowledgeSynchronizationSessionState.CLOSED);
    expect(closed.closedAt).toBeDefined();
  });

  it("throws when closing a session that is not open", () => {
    const session = new KnowledgeSynchronizationSession();
    session.open("stok_1", "holder-1");
    session.close("stok_1");
    expect(() => session.close("stok_1")).toThrow(SynchronizationSessionException);
  });

  it("cancels an open session", () => {
    const session = new KnowledgeSynchronizationSession();
    session.open("stok_1", "holder-1");
    const cancelled = session.cancel("stok_1");
    expect(cancelled.state).toBe(KnowledgeSynchronizationSessionState.CANCELLED);
  });

  it("expires a session regardless of its current state", () => {
    const session = new KnowledgeSynchronizationSession();
    session.open("stok_1", "holder-1");
    const expired = session.expire("stok_1");
    expect(expired.state).toBe(KnowledgeSynchronizationSessionState.EXPIRED);
  });

  it("resumes a closed session back to OPEN", () => {
    const session = new KnowledgeSynchronizationSession();
    session.open("stok_1", "holder-1");
    session.close("stok_1");
    const resumed = session.resume("stok_1");
    expect(resumed.state).toBe(KnowledgeSynchronizationSessionState.OPEN);
    expect(resumed.closedAt).toBeUndefined();
  });

  it("resumes an expired session back to OPEN", () => {
    const session = new KnowledgeSynchronizationSession();
    session.open("stok_1", "holder-1");
    session.expire("stok_1");
    const resumed = session.resume("stok_1");
    expect(resumed.state).toBe(KnowledgeSynchronizationSessionState.OPEN);
  });

  it("throws resuming a session that is currently open", () => {
    const session = new KnowledgeSynchronizationSession();
    session.open("stok_1", "holder-1");
    expect(() => session.resume("stok_1")).toThrow(SynchronizationSessionException);
  });

  it("renews an open session's expiry", () => {
    const session = new KnowledgeSynchronizationSession();
    session.open("stok_1", "holder-1");
    const renewed = session.renew("stok_1");
    expect(renewed.renewedAt).toBeDefined();
  });

  it("throws renewing an already-expired session's lease", () => {
    const session = new KnowledgeSynchronizationSession();
    session.open("stok_1", "holder-1", -1);
    expect(() => session.renew("stok_1")).toThrow(SynchronizationLeaseException);
  });

  it("throws requiring a session for an unknown token", () => {
    const session = new KnowledgeSynchronizationSession();
    expect(() => session.require("stok_missing")).toThrow(SynchronizationSessionException);
  });

  it("get() returns undefined for an unknown token", () => {
    const session = new KnowledgeSynchronizationSession();
    expect(session.get("stok_missing")).toBeUndefined();
  });

  it("get() returns the record for a known token", () => {
    const session = new KnowledgeSynchronizationSession();
    session.open("stok_1", "holder-1");
    expect(session.get("stok_1")).toBeDefined();
  });
});
