import { describe, expect, it } from "vitest";

import { RuntimeLeaseException } from "../../src/errors/runtime-lease-exception.js";
import { RuntimeSessionException } from "../../src/errors/runtime-session-exception.js";
import { KnowledgeRuntimeSessionState } from "../../src/session/knowledge-runtime-session-state.js";
import { KnowledgeRuntimeSession } from "../../src/session/knowledge-runtime-session.js";

describe("Session Test — KnowledgeRuntimeSession", () => {
  it("open() creates an OPEN Session with a Lease", () => {
    const session = new KnowledgeRuntimeSession();
    const record = session.open("ktok_1", "user-1");
    expect(record.state).toBe(KnowledgeRuntimeSessionState.OPEN);
    expect(record.lease.holder).toBe("user-1");
  });

  it("open() throws when a Session is already open for the token", () => {
    const session = new KnowledgeRuntimeSession();
    session.open("ktok_1", "user-1");
    expect(() => session.open("ktok_1", "user-2")).toThrow(RuntimeSessionException);
  });

  it("close() moves an OPEN Session to CLOSED", () => {
    const session = new KnowledgeRuntimeSession();
    session.open("ktok_1", "user-1");
    const closed = session.close("ktok_1");
    expect(closed.state).toBe(KnowledgeRuntimeSessionState.CLOSED);
    expect(closed.closedAt).toBeTruthy();
  });

  it("close() throws for an already-closed Session", () => {
    const session = new KnowledgeRuntimeSession();
    session.open("ktok_1", "user-1");
    session.close("ktok_1");
    expect(() => session.close("ktok_1")).toThrow(RuntimeSessionException);
  });

  it("suspend()/resume() round-trip OPEN -> SUSPENDED -> OPEN", () => {
    const session = new KnowledgeRuntimeSession();
    session.open("ktok_1", "user-1");
    const suspended = session.suspend("ktok_1");
    expect(suspended.state).toBe(KnowledgeRuntimeSessionState.SUSPENDED);
    const resumed = session.resume("ktok_1");
    expect(resumed.state).toBe(KnowledgeRuntimeSessionState.OPEN);
  });

  it("suspend() throws when the Session is not OPEN", () => {
    const session = new KnowledgeRuntimeSession();
    session.open("ktok_1", "user-1");
    session.suspend("ktok_1");
    expect(() => session.suspend("ktok_1")).toThrow(RuntimeSessionException);
  });

  it("renew() extends the Lease expiresAt", () => {
    const session = new KnowledgeRuntimeSession();
    const opened = session.open("ktok_1", "user-1", 1000);
    const renewed = session.renew("ktok_1", 5000);
    expect(Date.parse(renewed.lease.expiresAt)).toBeGreaterThan(Date.parse(opened.lease.expiresAt));
    expect(renewed.renewedAt).toBeTruthy();
  });

  it("renew() throws RuntimeLeaseException once the Lease already expired", () => {
    const session = new KnowledgeRuntimeSession();
    session.open("ktok_1", "user-1", -1);
    expect(() => session.renew("ktok_1")).toThrow(RuntimeLeaseException);
  });

  it("expire() moves a Session to EXPIRED", () => {
    const session = new KnowledgeRuntimeSession();
    session.open("ktok_1", "user-1");
    const expired = session.expire("ktok_1");
    expect(expired.state).toBe(KnowledgeRuntimeSessionState.EXPIRED);
  });

  it("destroy() removes the Session entirely", () => {
    const session = new KnowledgeRuntimeSession();
    session.open("ktok_1", "user-1");
    session.destroy("ktok_1");
    expect(session.get("ktok_1")).toBeUndefined();
  });

  it("require() throws RuntimeSessionException when no Session is open", () => {
    const session = new KnowledgeRuntimeSession();
    expect(() => session.require("ktok_missing")).toThrow(RuntimeSessionException);
  });

  it("get() returns undefined when no Session is open", () => {
    const session = new KnowledgeRuntimeSession();
    expect(session.get("ktok_missing")).toBeUndefined();
  });
});
