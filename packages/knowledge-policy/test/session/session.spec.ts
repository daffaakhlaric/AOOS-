import { describe, expect, it, vi } from "vitest";

import { PolicyLeaseException } from "../../src/errors/policy-lease-exception.js";
import { PolicySessionException } from "../../src/errors/policy-session-exception.js";
import { KnowledgePolicySessionState } from "../../src/session/knowledge-policy-session-state.js";
import { KnowledgePolicySession } from "../../src/session/knowledge-policy-session.js";

describe("KnowledgePolicySession", () => {
  it("opens a session for a token", () => {
    const session = new KnowledgePolicySession();
    const record = session.open("kpol_1", "holder-1");
    expect(record.state).toBe(KnowledgePolicySessionState.OPEN);
    expect(record.token).toBe("kpol_1");
    expect(record.holder).toBe("holder-1");
  });

  it("throws when opening an already-open token", () => {
    const session = new KnowledgePolicySession();
    session.open("kpol_1", "holder-1");
    expect(() => session.open("kpol_1", "holder-2")).toThrow(PolicySessionException);
  });

  it("closes an open session", () => {
    const session = new KnowledgePolicySession();
    session.open("kpol_1", "holder-1");
    const closed = session.close("kpol_1");
    expect(closed.state).toBe(KnowledgePolicySessionState.CLOSED);
    expect(closed.closedAt).toBeTruthy();
  });

  it("throws closing a session that isn't open", () => {
    const session = new KnowledgePolicySession();
    expect(() => session.close("missing")).toThrow(PolicySessionException);
  });

  it("cancels an open session", () => {
    const session = new KnowledgePolicySession();
    session.open("kpol_1", "holder-1");
    const cancelled = session.cancel("kpol_1");
    expect(cancelled.state).toBe(KnowledgePolicySessionState.CANCELLED);
  });

  it("throws cancelling a non-open session", () => {
    const session = new KnowledgePolicySession();
    session.open("kpol_1", "holder-1");
    session.close("kpol_1");
    expect(() => session.cancel("kpol_1")).toThrow(PolicySessionException);
  });

  it("expires a session regardless of current state", () => {
    const session = new KnowledgePolicySession();
    session.open("kpol_1", "holder-1");
    const expired = session.expire("kpol_1");
    expect(expired.state).toBe(KnowledgePolicySessionState.EXPIRED);
  });

  it("throws expiring an unknown token", () => {
    const session = new KnowledgePolicySession();
    expect(() => session.expire("missing")).toThrow(PolicySessionException);
  });

  it("resumes a closed session", () => {
    const session = new KnowledgePolicySession();
    session.open("kpol_1", "holder-1");
    session.close("kpol_1");
    const resumed = session.resume("kpol_1");
    expect(resumed.state).toBe(KnowledgePolicySessionState.OPEN);
    expect(resumed.closedAt).toBeUndefined();
  });

  it("resumes an expired session", () => {
    const session = new KnowledgePolicySession();
    session.open("kpol_1", "holder-1");
    session.expire("kpol_1");
    const resumed = session.resume("kpol_1");
    expect(resumed.state).toBe(KnowledgePolicySessionState.OPEN);
  });

  it("throws resuming a session that's still open", () => {
    const session = new KnowledgePolicySession();
    session.open("kpol_1", "holder-1");
    expect(() => session.resume("kpol_1")).toThrow(PolicySessionException);
  });

  it("renews an open session, extending expiresAt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const session = new KnowledgePolicySession();
    session.open("kpol_1", "holder-1", 1000);
    vi.setSystemTime(new Date("2026-01-01T00:00:00.500Z"));
    const renewed = session.renew("kpol_1", 5000);
    expect(renewed.renewedAt).toBeTruthy();
    expect(Date.parse(renewed.expiresAt)).toBeGreaterThan(Date.parse("2026-01-01T00:00:00.500Z"));
    vi.useRealTimers();
  });

  it("throws renewing a non-open session", () => {
    const session = new KnowledgePolicySession();
    session.open("kpol_1", "holder-1");
    session.close("kpol_1");
    expect(() => session.renew("kpol_1")).toThrow(PolicySessionException);
  });

  it("throws PolicyLeaseException renewing an already-expired open session", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const session = new KnowledgePolicySession();
    session.open("kpol_1", "holder-1", 10);
    vi.setSystemTime(new Date("2026-01-01T00:00:05.000Z"));
    expect(() => session.renew("kpol_1")).toThrow(PolicyLeaseException);
    vi.useRealTimers();
  });

  it("get() returns undefined for an unknown token", () => {
    const session = new KnowledgePolicySession();
    expect(session.get("missing")).toBeUndefined();
  });

  it("get() returns the record for a known token", () => {
    const session = new KnowledgePolicySession();
    const opened = session.open("kpol_1", "holder-1");
    expect(session.get("kpol_1")).toEqual(opened);
  });

  it("require() throws for an unknown token", () => {
    const session = new KnowledgePolicySession();
    expect(() => session.require("missing")).toThrow(PolicySessionException);
  });
});
