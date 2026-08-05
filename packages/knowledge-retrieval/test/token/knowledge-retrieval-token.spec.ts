import { describe, expect, it } from "vitest";

import {
  generateKnowledgeRetrievalToken,
  isKnowledgeRetrievalToken,
} from "../../src/token/knowledge-retrieval-token.js";

describe("KnowledgeRetrievalToken", () => {
  it("generates a token prefixed with rtok_", () => {
    const token = generateKnowledgeRetrievalToken();
    expect(token.startsWith("rtok_")).toBe(true);
  });

  it("generates unique tokens", () => {
    expect(generateKnowledgeRetrievalToken()).not.toBe(generateKnowledgeRetrievalToken());
  });

  it("recognizes a well-formed token", () => {
    expect(isKnowledgeRetrievalToken(generateKnowledgeRetrievalToken())).toBe(true);
  });

  it("rejects a malformed token", () => {
    expect(isKnowledgeRetrievalToken("not-a-token")).toBe(false);
  });

  it("rejects a token with the wrong prefix", () => {
    expect(isKnowledgeRetrievalToken("ktok_11111111-1111-4111-8111-111111111111")).toBe(false);
  });

  it("rejects a non-string value", () => {
    expect(isKnowledgeRetrievalToken(42)).toBe(false);
  });
});
