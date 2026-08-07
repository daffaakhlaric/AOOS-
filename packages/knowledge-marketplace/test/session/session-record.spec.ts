import { describe, expect, it } from "vitest";

import { knowledgeMarketplaceSessionRecordSchema } from "../../src/session/knowledge-marketplace-session-record.js";
import { KnowledgeMarketplaceSessionState } from "../../src/session/knowledge-marketplace-session-state.js";

describe("knowledgeMarketplaceSessionRecordSchema", () => {
  it("parses a valid session record", () => {
    const record = {
      id: "session-1",
      token: "kmkt_1",
      holder: "holder-1",
      state: KnowledgeMarketplaceSessionState.OPEN,
      openedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:15:00.000Z",
    };
    expect(() => knowledgeMarketplaceSessionRecordSchema.parse(record)).not.toThrow();
  });

  it("parses a closed session record with closedAt/renewedAt", () => {
    const record = {
      id: "session-1",
      token: "kmkt_1",
      holder: "holder-1",
      state: KnowledgeMarketplaceSessionState.CLOSED,
      openedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:15:00.000Z",
      closedAt: "2026-01-01T00:05:00.000Z",
      renewedAt: "2026-01-01T00:02:00.000Z",
    };
    expect(() => knowledgeMarketplaceSessionRecordSchema.parse(record)).not.toThrow();
  });

  it("rejects a record with an empty holder", () => {
    const record = {
      id: "session-1",
      token: "kmkt_1",
      holder: "",
      state: KnowledgeMarketplaceSessionState.OPEN,
      openedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:15:00.000Z",
    };
    expect(() => knowledgeMarketplaceSessionRecordSchema.parse(record)).toThrow();
  });
});
