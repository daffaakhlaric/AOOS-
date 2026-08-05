import { describe, expect, it } from "vitest";

import { ProviderLeaseException } from "../../src/errors/provider-lease-exception.js";
import { ProviderSessionException } from "../../src/errors/provider-session-exception.js";
import { KnowledgeProviderSessionState } from "../../src/session/knowledge-provider-session-state.js";
import { KnowledgeProviderSession } from "../../src/session/knowledge-provider-session.js";

describe("KnowledgeProviderSession", () => {
  it("opens a new session in the OPEN state", () => {
    const session = new KnowledgeProviderSession();
    const record = session.open("ptok_1", "holder-1");
    expect(record.state).toBe(KnowledgeProviderSessionState.OPEN);
    expect(record.holder).toBe("holder-1");
  });

  it("throws when opening a session for a token already open", () => {
    const session = new KnowledgeProviderSession();
    session.open("ptok_1", "holder-1");
    expect(() => session.open("ptok_1", "holder-1")).toThrow(ProviderSessionException);
  });

  it("closes an open session", () => {
    const session = new KnowledgeProviderSession();
    session.open("ptok_1", "holder-1");
    const closed = session.close("ptok_1");
    expect(closed.state).toBe(KnowledgeProviderSessionState.CLOSED);
    expect(closed.closedAt).toBeDefined();
  });

  it("throws when closing a session that is not open", () => {
    const session = new KnowledgeProviderSession();
    session.open("ptok_1", "holder-1");
    session.close("ptok_1");
    expect(() => session.close("ptok_1")).toThrow(ProviderSessionException);
  });

  it("cancels an open session", () => {
    const session = new KnowledgeProviderSession();
    session.open("ptok_1", "holder-1");
    const cancelled = session.cancel("ptok_1");
    expect(cancelled.state).toBe(KnowledgeProviderSessionState.CANCELLED);
  });

  it("expires a session regardless of its current state", () => {
    const session = new KnowledgeProviderSession();
    session.open("ptok_1", "holder-1");
    const expired = session.expire("ptok_1");
    expect(expired.state).toBe(KnowledgeProviderSessionState.EXPIRED);
  });

  it("resumes a closed session back to OPEN", () => {
    const session = new KnowledgeProviderSession();
    session.open("ptok_1", "holder-1");
    session.close("ptok_1");
    const resumed = session.resume("ptok_1");
    expect(resumed.state).toBe(KnowledgeProviderSessionState.OPEN);
    expect(resumed.closedAt).toBeUndefined();
  });

  it("resumes an expired session back to OPEN", () => {
    const session = new KnowledgeProviderSession();
    session.open("ptok_1", "holder-1");
    session.expire("ptok_1");
    const resumed = session.resume("ptok_1");
    expect(resumed.state).toBe(KnowledgeProviderSessionState.OPEN);
  });

  it("throws resuming a session that is currently open", () => {
    const session = new KnowledgeProviderSession();
    session.open("ptok_1", "holder-1");
    expect(() => session.resume("ptok_1")).toThrow(ProviderSessionException);
  });

  it("renews an open session's expiry", () => {
    const session = new KnowledgeProviderSession();
    session.open("ptok_1", "holder-1");
    const renewed = session.renew("ptok_1");
    expect(renewed.renewedAt).toBeDefined();
  });

  it("throws renewing an already-expired session's lease", () => {
    const session = new KnowledgeProviderSession();
    session.open("ptok_1", "holder-1", -1);
    expect(() => session.renew("ptok_1")).toThrow(ProviderLeaseException);
  });

  it("throws requiring a session for an unknown token", () => {
    const session = new KnowledgeProviderSession();
    expect(() => session.require("ptok_missing")).toThrow(ProviderSessionException);
  });

  it("get() returns undefined for an unknown token", () => {
    const session = new KnowledgeProviderSession();
    expect(session.get("ptok_missing")).toBeUndefined();
  });

  it("get() returns the record for a known token", () => {
    const session = new KnowledgeProviderSession();
    session.open("ptok_1", "holder-1");
    expect(session.get("ptok_1")).toBeDefined();
  });
});
