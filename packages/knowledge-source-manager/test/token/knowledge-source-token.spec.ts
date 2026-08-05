import { describe, expect, it } from "vitest";

import {
  generateKnowledgeSourceToken,
  isKnowledgeSourceToken,
} from "../../src/token/knowledge-source-token.js";

describe("KnowledgeSourceToken", () => {
  it("generates a token prefixed ksrc_", () => {
    expect(generateKnowledgeSourceToken()).toMatch(/^ksrc_/);
  });

  it("generates structurally valid tokens", () => {
    expect(isKnowledgeSourceToken(generateKnowledgeSourceToken())).toBe(true);
  });

  it("generates unique tokens", () => {
    expect(generateKnowledgeSourceToken()).not.toBe(generateKnowledgeSourceToken());
  });

  it("rejects the knowledge-synchronization stok_ prefix (no collision)", () => {
    expect(isKnowledgeSourceToken("stok_11111111-1111-4111-8111-111111111111")).toBe(false);
  });

  it("rejects the knowledge-provider ptok_ prefix (no collision)", () => {
    expect(isKnowledgeSourceToken("ptok_11111111-1111-4111-8111-111111111111")).toBe(false);
  });

  it("rejects a non-string value", () => {
    expect(isKnowledgeSourceToken(42)).toBe(false);
  });

  it("rejects a malformed ksrc_ token", () => {
    expect(isKnowledgeSourceToken("ksrc_not-a-uuid")).toBe(false);
  });
});
