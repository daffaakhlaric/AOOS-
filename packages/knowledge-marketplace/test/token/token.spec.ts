import { describe, expect, it } from "vitest";

import {
  generateKnowledgeMarketplaceToken,
  isKnowledgeMarketplaceToken,
} from "../../src/token/knowledge-marketplace-token.js";

describe("KnowledgeMarketplaceToken", () => {
  it("generates a token prefixed with kmkt_", () => {
    expect(generateKnowledgeMarketplaceToken().startsWith("kmkt_")).toBe(true);
  });

  it("generates a structurally valid token", () => {
    expect(isKnowledgeMarketplaceToken(generateKnowledgeMarketplaceToken())).toBe(true);
  });

  it("generates unique tokens", () => {
    expect(generateKnowledgeMarketplaceToken()).not.toBe(generateKnowledgeMarketplaceToken());
  });

  it("rejects a token with the wrong prefix", () => {
    expect(isKnowledgeMarketplaceToken("kpol_00000000-0000-4000-8000-000000000000")).toBe(false);
  });

  it("rejects a malformed UUID suffix", () => {
    expect(isKnowledgeMarketplaceToken("kmkt_not-a-uuid")).toBe(false);
  });

  it("rejects a non-string value", () => {
    expect(isKnowledgeMarketplaceToken(12345)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isKnowledgeMarketplaceToken(undefined)).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isKnowledgeMarketplaceToken("")).toBe(false);
  });
});
