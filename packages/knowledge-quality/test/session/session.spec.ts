import { describe, expect, it } from "vitest";

import { KnowledgeQualitySessionState } from "../../src/domain/knowledge-quality-session-state.js";
import { QualityLeaseException } from "../../src/errors/quality-lease-exception.js";
import { QualitySessionException } from "../../src/errors/quality-session-exception.js";
import { KnowledgeQualitySession } from "../../src/session/knowledge-quality-session.js";

describe("KnowledgeQualitySession", () => {
  it("opens a Session in the OPEN state", () => {
    const session = new KnowledgeQualitySession();
    const record = session.open("kqua_1", "holder-1");
    expect(record.state).toBe(KnowledgeQualitySessionState.OPEN);
    expect(record.holder).toBe("holder-1");
  });

  it("rejects opening a Session twice for the same token", () => {
    const session = new KnowledgeQualitySession();
    session.open("kqua_1", "holder-1");
    expect(() => session.open("kqua_1", "holder-1")).toThrow(QualitySessionException);
  });

  it("closes an OPEN Session", () => {
    const session = new KnowledgeQualitySession();
    session.open("kqua_1", "holder-1");
    const closed = session.close("kqua_1");
    expect(closed.state).toBe(KnowledgeQualitySessionState.CLOSED);
    expect(closed.closedAt).toBeDefined();
  });

  it("rejects closing a Session that is not OPEN", () => {
    const session = new KnowledgeQualitySession();
    session.open("kqua_1", "holder-1");
    session.close("kqua_1");
    expect(() => session.close("kqua_1")).toThrow(QualitySessionException);
  });

  it("cancels an OPEN Session", () => {
    const session = new KnowledgeQualitySession();
    session.open("kqua_1", "holder-1");
    const cancelled = session.cancel("kqua_1");
    expect(cancelled.state).toBe(KnowledgeQualitySessionState.CANCELLED);
  });

  it("rejects cancelling a Session that is not OPEN", () => {
    const session = new KnowledgeQualitySession();
    session.open("kqua_1", "holder-1");
    session.cancel("kqua_1");
    expect(() => session.cancel("kqua_1")).toThrow(QualitySessionException);
  });

  it("expires a Session regardless of its current state", () => {
    const session = new KnowledgeQualitySession();
    session.open("kqua_1", "holder-1");
    const expired = session.expire("kqua_1");
    expect(expired.state).toBe(KnowledgeQualitySessionState.EXPIRED);
  });

  it("resumes a CLOSED Session back to OPEN", () => {
    const session = new KnowledgeQualitySession();
    session.open("kqua_1", "holder-1");
    session.close("kqua_1");
    const resumed = session.resume("kqua_1");
    expect(resumed.state).toBe(KnowledgeQualitySessionState.OPEN);
    expect(resumed.closedAt).toBeUndefined();
  });

  it("resumes an EXPIRED Session back to OPEN", () => {
    const session = new KnowledgeQualitySession();
    session.open("kqua_1", "holder-1");
    session.expire("kqua_1");
    const resumed = session.resume("kqua_1");
    expect(resumed.state).toBe(KnowledgeQualitySessionState.OPEN);
  });

  it("rejects resuming an already-OPEN Session", () => {
    const session = new KnowledgeQualitySession();
    session.open("kqua_1", "holder-1");
    expect(() => session.resume("kqua_1")).toThrow(QualitySessionException);
  });

  it("renews an OPEN Session's expiry", () => {
    const session = new KnowledgeQualitySession();
    const opened = session.open("kqua_1", "holder-1", 1000);
    const renewed = session.renew("kqua_1", 5000);
    expect(Date.parse(renewed.expiresAt)).toBeGreaterThanOrEqual(Date.parse(opened.expiresAt));
    expect(renewed.renewedAt).toBeDefined();
  });

  it("rejects renewing a non-OPEN Session", () => {
    const session = new KnowledgeQualitySession();
    session.open("kqua_1", "holder-1");
    session.close("kqua_1");
    expect(() => session.renew("kqua_1")).toThrow(QualitySessionException);
  });

  it("rejects renewing an already-expired Session lease", () => {
    const session = new KnowledgeQualitySession();
    session.open("kqua_1", "holder-1", -1000);
    expect(() => session.renew("kqua_1")).toThrow(QualityLeaseException);
  });

  it("get() returns undefined for an unknown token", () => {
    const session = new KnowledgeQualitySession();
    expect(session.get("kqua_unknown")).toBeUndefined();
  });

  it("require() throws for an unknown token", () => {
    const session = new KnowledgeQualitySession();
    expect(() => session.require("kqua_unknown")).toThrow(QualitySessionException);
  });

  it("require() returns the record for a known token", () => {
    const session = new KnowledgeQualitySession();
    session.open("kqua_1", "holder-1");
    expect(session.require("kqua_1").token).toBe("kqua_1");
  });
});
