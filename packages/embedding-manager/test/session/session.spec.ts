import { describe, expect, it } from "vitest";

import { EmbeddingSessionState } from "../../src/domain/embedding-session-state.js";
import { EmbeddingSessionException } from "../../src/errors/embedding-session-exception.js";
import { EmbeddingSession } from "../../src/session/embedding-session.js";

describe("EmbeddingSession", () => {
  it("open() creates a new OPEN record", () => {
    const session = new EmbeddingSession();
    const record = session.open("tok-1", "user-1");
    expect(record.state).toBe(EmbeddingSessionState.OPEN);
    expect(record.holder).toBe("user-1");
  });

  it("open() throws when a Session is already open for the token", () => {
    const session = new EmbeddingSession();
    session.open("tok-1", "user-1");
    expect(() => session.open("tok-1", "user-1")).toThrow(EmbeddingSessionException);
  });

  it("close() transitions an OPEN session to CLOSED", () => {
    const session = new EmbeddingSession();
    session.open("tok-1", "user-1");
    const record = session.close("tok-1");
    expect(record.state).toBe(EmbeddingSessionState.CLOSED);
    expect(record.closedAt).toBeDefined();
  });

  it("close() throws when the session is not OPEN", () => {
    const session = new EmbeddingSession();
    session.open("tok-1", "user-1");
    session.close("tok-1");
    expect(() => session.close("tok-1")).toThrow(EmbeddingSessionException);
  });

  it("cancel() transitions an OPEN session to CANCELLED", () => {
    const session = new EmbeddingSession();
    session.open("tok-1", "user-1");
    const record = session.cancel("tok-1");
    expect(record.state).toBe(EmbeddingSessionState.CANCELLED);
  });

  it("expire() transitions any known session to EXPIRED", () => {
    const session = new EmbeddingSession();
    session.open("tok-1", "user-1");
    const record = session.expire("tok-1");
    expect(record.state).toBe(EmbeddingSessionState.EXPIRED);
  });

  it("expire() throws for an unknown token", () => {
    const session = new EmbeddingSession();
    expect(() => session.expire("missing")).toThrow(EmbeddingSessionException);
  });

  it("resume() reopens a CLOSED session", () => {
    const session = new EmbeddingSession();
    session.open("tok-1", "user-1");
    session.close("tok-1");
    const record = session.resume("tok-1");
    expect(record.state).toBe(EmbeddingSessionState.OPEN);
    expect(record.closedAt).toBeUndefined();
  });

  it("resume() reopens an EXPIRED session", () => {
    const session = new EmbeddingSession();
    session.open("tok-1", "user-1");
    session.expire("tok-1");
    const record = session.resume("tok-1");
    expect(record.state).toBe(EmbeddingSessionState.OPEN);
  });

  it("resume() throws when the session is still OPEN", () => {
    const session = new EmbeddingSession();
    session.open("tok-1", "user-1");
    expect(() => session.resume("tok-1")).toThrow(EmbeddingSessionException);
  });

  it("renew() extends expiresAt for an OPEN session", () => {
    const session = new EmbeddingSession();
    const original = session.open("tok-1", "user-1", 1000);
    const renewed = session.renew("tok-1", 60_000);
    expect(Date.parse(renewed.expiresAt)).toBeGreaterThan(Date.parse(original.expiresAt));
    expect(renewed.renewedAt).toBeDefined();
  });

  it("renew() throws when the session already expired", () => {
    const session = new EmbeddingSession();
    session.open("tok-1", "user-1", -1000);
    expect(() => session.renew("tok-1")).toThrow(EmbeddingSessionException);
  });

  it("renew() throws when the session is not OPEN", () => {
    const session = new EmbeddingSession();
    session.open("tok-1", "user-1");
    session.close("tok-1");
    expect(() => session.renew("tok-1")).toThrow(EmbeddingSessionException);
  });

  it("get() returns undefined for an unknown token", () => {
    const session = new EmbeddingSession();
    expect(session.get("missing")).toBeUndefined();
  });

  it("get() returns the record for a known token", () => {
    const session = new EmbeddingSession();
    session.open("tok-1", "user-1");
    expect(session.get("tok-1")).toBeDefined();
  });

  it("require() throws for an unknown token", () => {
    const session = new EmbeddingSession();
    expect(() => session.require("missing")).toThrow(EmbeddingSessionException);
  });

  it("require() returns the record for a known token", () => {
    const session = new EmbeddingSession();
    session.open("tok-1", "user-1");
    expect(session.require("tok-1").holder).toBe("user-1");
  });
});
