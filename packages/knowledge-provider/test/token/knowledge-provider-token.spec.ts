import { describe, expect, it } from "vitest";

import {
  generateKnowledgeProviderToken,
  isKnowledgeProviderToken,
} from "../../src/token/knowledge-provider-token.js";

describe("KnowledgeProviderToken", () => {
  it("generates a token prefixed with ptok_", () => {
    const token = generateKnowledgeProviderToken();
    expect(token.startsWith("ptok_")).toBe(true);
  });

  it("generates unique tokens", () => {
    expect(generateKnowledgeProviderToken()).not.toBe(generateKnowledgeProviderToken());
  });

  it("recognizes a well-formed token", () => {
    expect(isKnowledgeProviderToken(generateKnowledgeProviderToken())).toBe(true);
  });

  it("rejects a malformed token", () => {
    expect(isKnowledgeProviderToken("not-a-token")).toBe(false);
  });

  it("rejects a token with the wrong prefix", () => {
    expect(isKnowledgeProviderToken("stok_11111111-1111-4111-8111-111111111111")).toBe(false);
  });

  it("rejects a non-string value", () => {
    expect(isKnowledgeProviderToken(42)).toBe(false);
  });
});
