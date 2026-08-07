import { beforeEach, describe, expect, it } from "vitest";

import { MarketplaceLeaseException } from "../../src/errors/marketplace-lease-exception.js";
import { MarketplaceSessionException } from "../../src/errors/marketplace-session-exception.js";
import { KnowledgeMarketplaceSessionState } from "../../src/session/knowledge-marketplace-session-state.js";
import { KnowledgeMarketplaceSession } from "../../src/session/knowledge-marketplace-session.js";

describe("KnowledgeMarketplaceSession", () => {
  let session: KnowledgeMarketplaceSession;

  beforeEach(() => {
    session = new KnowledgeMarketplaceSession();
  });

  it("opens a new session", () => {
    const record = session.open("token-1", "holder-1");
    expect(record.state).toBe(KnowledgeMarketplaceSessionState.OPEN);
  });

  it("throws when opening a token that already has a session", () => {
    session.open("token-1", "holder-1");
    expect(() => session.open("token-1", "holder-1")).toThrow(MarketplaceSessionException);
  });

  it("closes an open session", () => {
    session.open("token-1", "holder-1");
    const record = session.close("token-1");
    expect(record.state).toBe(KnowledgeMarketplaceSessionState.CLOSED);
    expect(record.closedAt).toBeDefined();
  });

  it("throws closing a session that is not open", () => {
    session.open("token-1", "holder-1");
    session.close("token-1");
    expect(() => session.close("token-1")).toThrow(MarketplaceSessionException);
  });

  it("cancels an open session", () => {
    session.open("token-1", "holder-1");
    const record = session.cancel("token-1");
    expect(record.state).toBe(KnowledgeMarketplaceSessionState.CANCELLED);
  });

  it("throws cancelling a session that is not open", () => {
    session.open("token-1", "holder-1");
    session.cancel("token-1");
    expect(() => session.cancel("token-1")).toThrow(MarketplaceSessionException);
  });

  it("expires any known session", () => {
    session.open("token-1", "holder-1");
    const record = session.expire("token-1");
    expect(record.state).toBe(KnowledgeMarketplaceSessionState.EXPIRED);
  });

  it("throws expiring an unknown token", () => {
    expect(() => session.expire("missing")).toThrow(MarketplaceSessionException);
  });

  it("resumes a closed session", () => {
    session.open("token-1", "holder-1");
    session.close("token-1");
    const record = session.resume("token-1");
    expect(record.state).toBe(KnowledgeMarketplaceSessionState.OPEN);
    expect(record.closedAt).toBeUndefined();
  });

  it("resumes an expired session", () => {
    session.open("token-1", "holder-1");
    session.expire("token-1");
    const record = session.resume("token-1");
    expect(record.state).toBe(KnowledgeMarketplaceSessionState.OPEN);
  });

  it("throws resuming an open session", () => {
    session.open("token-1", "holder-1");
    expect(() => session.resume("token-1")).toThrow(MarketplaceSessionException);
  });

  it("renews an open session", () => {
    session.open("token-1", "holder-1");
    const record = session.renew("token-1");
    expect(record.renewedAt).toBeDefined();
  });

  it("throws renewing a closed session", () => {
    session.open("token-1", "holder-1");
    session.close("token-1");
    expect(() => session.renew("token-1")).toThrow(MarketplaceSessionException);
  });

  it("throws MarketplaceLeaseException renewing an already-expired open session", () => {
    session.open("token-1", "holder-1", -1);
    expect(() => session.renew("token-1")).toThrow(MarketplaceLeaseException);
  });

  it("get returns undefined for an unknown token", () => {
    expect(session.get("missing")).toBeUndefined();
  });

  it("require throws for an unknown token", () => {
    expect(() => session.require("missing")).toThrow(MarketplaceSessionException);
  });

  it("require returns the session record for a known token", () => {
    session.open("token-1", "holder-1");
    expect(session.require("token-1").holder).toBe("holder-1");
  });

  it("open accepts a custom ttlMs", () => {
    const record = session.open("token-1", "holder-1", 60000);
    expect(Date.parse(record.expiresAt)).toBeGreaterThan(Date.parse(record.openedAt));
  });
});
