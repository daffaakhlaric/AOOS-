import { describe, expect, it } from "vitest";

import { KnowledgeValidationSessionState } from "../../src/domain/knowledge-validation-session-state.js";
import { ValidatorLeaseException } from "../../src/errors/validator-lease-exception.js";
import { ValidatorSessionException } from "../../src/errors/validator-session-exception.js";
import { KnowledgeValidatorSession } from "../../src/session/knowledge-validator-session.js";

describe("KnowledgeValidatorSession", () => {
  it("opens a new session", () => {
    const session = new KnowledgeValidatorSession();
    const record = session.open("tok-1", "holder-1");
    expect(record.state).toBe(KnowledgeValidationSessionState.OPEN);
    expect(record.holder).toBe("holder-1");
  });

  it("throws when opening a session for a token already open", () => {
    const session = new KnowledgeValidatorSession();
    session.open("tok-1", "holder-1");
    expect(() => session.open("tok-1", "holder-2")).toThrow(ValidatorSessionException);
  });

  it("closes an open session", () => {
    const session = new KnowledgeValidatorSession();
    session.open("tok-1", "holder-1");
    const record = session.close("tok-1");
    expect(record.state).toBe(KnowledgeValidationSessionState.CLOSED);
    expect(record.closedAt).toBeDefined();
  });

  it("throws when closing a session that is not open", () => {
    const session = new KnowledgeValidatorSession();
    session.open("tok-1", "holder-1");
    session.close("tok-1");
    expect(() => session.close("tok-1")).toThrow(ValidatorSessionException);
  });

  it("cancels an open session", () => {
    const session = new KnowledgeValidatorSession();
    session.open("tok-1", "holder-1");
    const record = session.cancel("tok-1");
    expect(record.state).toBe(KnowledgeValidationSessionState.CANCELLED);
  });

  it("throws when cancelling a session that is not open", () => {
    const session = new KnowledgeValidatorSession();
    session.open("tok-1", "holder-1");
    session.cancel("tok-1");
    expect(() => session.cancel("tok-1")).toThrow(ValidatorSessionException);
  });

  it("expires a session from any state", () => {
    const session = new KnowledgeValidatorSession();
    session.open("tok-1", "holder-1");
    const record = session.expire("tok-1");
    expect(record.state).toBe(KnowledgeValidationSessionState.EXPIRED);
  });

  it("throws when expiring an unknown token", () => {
    const session = new KnowledgeValidatorSession();
    expect(() => session.expire("unknown")).toThrow(ValidatorSessionException);
  });

  it("resumes a closed session", () => {
    const session = new KnowledgeValidatorSession();
    session.open("tok-1", "holder-1");
    session.close("tok-1");
    const record = session.resume("tok-1");
    expect(record.state).toBe(KnowledgeValidationSessionState.OPEN);
    expect(record.closedAt).toBeUndefined();
  });

  it("resumes an expired session", () => {
    const session = new KnowledgeValidatorSession();
    session.open("tok-1", "holder-1");
    session.expire("tok-1");
    const record = session.resume("tok-1");
    expect(record.state).toBe(KnowledgeValidationSessionState.OPEN);
  });

  it("throws when resuming an open session", () => {
    const session = new KnowledgeValidatorSession();
    session.open("tok-1", "holder-1");
    expect(() => session.resume("tok-1")).toThrow(ValidatorSessionException);
  });

  it("renews an open session's expiry", () => {
    const session = new KnowledgeValidatorSession();
    const opened = session.open("tok-1", "holder-1", 1000);
    const renewed = session.renew("tok-1", 5000);
    expect(Date.parse(renewed.expiresAt)).toBeGreaterThanOrEqual(Date.parse(opened.expiresAt));
    expect(renewed.renewedAt).toBeDefined();
  });

  it("throws ValidatorLeaseException when renewing an already-expired session", () => {
    const session = new KnowledgeValidatorSession();
    session.open("tok-1", "holder-1", -1000);
    expect(() => session.renew("tok-1")).toThrow(ValidatorLeaseException);
  });

  it("throws when renewing a session that is not open", () => {
    const session = new KnowledgeValidatorSession();
    session.open("tok-1", "holder-1");
    session.close("tok-1");
    expect(() => session.renew("tok-1")).toThrow(ValidatorSessionException);
  });

  it("get returns undefined for an unknown token", () => {
    const session = new KnowledgeValidatorSession();
    expect(session.get("unknown")).toBeUndefined();
  });

  it("get returns the record for a known token", () => {
    const session = new KnowledgeValidatorSession();
    session.open("tok-1", "holder-1");
    expect(session.get("tok-1")).toBeDefined();
  });

  it("require throws for an unknown token", () => {
    const session = new KnowledgeValidatorSession();
    expect(() => session.require("unknown")).toThrow(ValidatorSessionException);
  });

  it("require returns the record for a known token", () => {
    const session = new KnowledgeValidatorSession();
    session.open("tok-1", "holder-1");
    expect(session.require("tok-1").holder).toBe("holder-1");
  });

  it("uses the default TTL when none is supplied", () => {
    const session = new KnowledgeValidatorSession();
    const record = session.open("tok-1", "holder-1");
    const ttl = Date.parse(record.expiresAt) - Date.parse(record.openedAt);
    expect(ttl).toBeGreaterThan(14 * 60 * 1000);
  });
});
