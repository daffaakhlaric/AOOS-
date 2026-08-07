import { describe, expect, it } from "vitest";

import { KnowledgeGeneratorSessionState } from "../../src/domain/knowledge-generator-session-state.js";
import { GeneratorLeaseException } from "../../src/errors/generator-lease-exception.js";
import { GeneratorSessionException } from "../../src/errors/generator-session-exception.js";
import { KnowledgeGeneratorSession } from "../../src/session/knowledge-generator-session.js";

describe("KnowledgeGeneratorSession", () => {
  it("opens a Session in the OPEN state", () => {
    const session = new KnowledgeGeneratorSession();
    const record = session.open("kgen_1", "holder-1");
    expect(record.state).toBe(KnowledgeGeneratorSessionState.OPEN);
    expect(record.holder).toBe("holder-1");
  });

  it("rejects opening a Session twice for the same token", () => {
    const session = new KnowledgeGeneratorSession();
    session.open("kgen_1", "holder-1");
    expect(() => session.open("kgen_1", "holder-1")).toThrow(GeneratorSessionException);
  });

  it("closes an OPEN Session", () => {
    const session = new KnowledgeGeneratorSession();
    session.open("kgen_1", "holder-1");
    const closed = session.close("kgen_1");
    expect(closed.state).toBe(KnowledgeGeneratorSessionState.CLOSED);
    expect(closed.closedAt).toBeDefined();
  });

  it("rejects closing a Session that is not OPEN", () => {
    const session = new KnowledgeGeneratorSession();
    session.open("kgen_1", "holder-1");
    session.close("kgen_1");
    expect(() => session.close("kgen_1")).toThrow(GeneratorSessionException);
  });

  it("cancels an OPEN Session", () => {
    const session = new KnowledgeGeneratorSession();
    session.open("kgen_1", "holder-1");
    const cancelled = session.cancel("kgen_1");
    expect(cancelled.state).toBe(KnowledgeGeneratorSessionState.CANCELLED);
  });

  it("rejects cancelling a Session that is not OPEN", () => {
    const session = new KnowledgeGeneratorSession();
    session.open("kgen_1", "holder-1");
    session.cancel("kgen_1");
    expect(() => session.cancel("kgen_1")).toThrow(GeneratorSessionException);
  });

  it("expires a Session regardless of its current state", () => {
    const session = new KnowledgeGeneratorSession();
    session.open("kgen_1", "holder-1");
    const expired = session.expire("kgen_1");
    expect(expired.state).toBe(KnowledgeGeneratorSessionState.EXPIRED);
  });

  it("resumes a CLOSED Session back to OPEN", () => {
    const session = new KnowledgeGeneratorSession();
    session.open("kgen_1", "holder-1");
    session.close("kgen_1");
    const resumed = session.resume("kgen_1");
    expect(resumed.state).toBe(KnowledgeGeneratorSessionState.OPEN);
    expect(resumed.closedAt).toBeUndefined();
  });

  it("resumes an EXPIRED Session back to OPEN", () => {
    const session = new KnowledgeGeneratorSession();
    session.open("kgen_1", "holder-1");
    session.expire("kgen_1");
    const resumed = session.resume("kgen_1");
    expect(resumed.state).toBe(KnowledgeGeneratorSessionState.OPEN);
  });

  it("rejects resuming an already-OPEN Session", () => {
    const session = new KnowledgeGeneratorSession();
    session.open("kgen_1", "holder-1");
    expect(() => session.resume("kgen_1")).toThrow(GeneratorSessionException);
  });

  it("renews an OPEN Session's expiry", () => {
    const session = new KnowledgeGeneratorSession();
    const opened = session.open("kgen_1", "holder-1", 1000);
    const renewed = session.renew("kgen_1", 5000);
    expect(Date.parse(renewed.expiresAt)).toBeGreaterThanOrEqual(Date.parse(opened.expiresAt));
    expect(renewed.renewedAt).toBeDefined();
  });

  it("rejects renewing a non-OPEN Session", () => {
    const session = new KnowledgeGeneratorSession();
    session.open("kgen_1", "holder-1");
    session.close("kgen_1");
    expect(() => session.renew("kgen_1")).toThrow(GeneratorSessionException);
  });

  it("rejects renewing an already-expired Session lease", () => {
    const session = new KnowledgeGeneratorSession();
    session.open("kgen_1", "holder-1", -1000);
    expect(() => session.renew("kgen_1")).toThrow(GeneratorLeaseException);
  });

  it("get() returns undefined for an unknown token", () => {
    const session = new KnowledgeGeneratorSession();
    expect(session.get("kgen_unknown")).toBeUndefined();
  });

  it("require() throws for an unknown token", () => {
    const session = new KnowledgeGeneratorSession();
    expect(() => session.require("kgen_unknown")).toThrow(GeneratorSessionException);
  });

  it("require() returns the record for a known token", () => {
    const session = new KnowledgeGeneratorSession();
    session.open("kgen_1", "holder-1");
    expect(session.require("kgen_1").token).toBe("kgen_1");
  });
});
