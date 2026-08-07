import { describe, expect, it } from "vitest";

import {
  generateEmbeddingManagerToken,
  isEmbeddingManagerToken,
} from "../../src/token/embedding-manager-token.js";

describe("EmbeddingManagerToken", () => {
  it("generateEmbeddingManagerToken produces a token prefixed with embt_", () => {
    const token = generateEmbeddingManagerToken();
    expect(token.startsWith("embt_")).toBe(true);
  });

  it("generateEmbeddingManagerToken produces unique tokens", () => {
    const a = generateEmbeddingManagerToken();
    const b = generateEmbeddingManagerToken();
    expect(a).not.toBe(b);
  });

  it("isEmbeddingManagerToken accepts a well-formed generated token", () => {
    expect(isEmbeddingManagerToken(generateEmbeddingManagerToken())).toBe(true);
  });

  it("isEmbeddingManagerToken rejects a token with the wrong prefix", () => {
    expect(isEmbeddingManagerToken("kval_11111111-1111-4111-8111-111111111111")).toBe(false);
  });

  it("isEmbeddingManagerToken rejects a malformed UUID body", () => {
    expect(isEmbeddingManagerToken("embt_not-a-uuid")).toBe(false);
  });

  it("isEmbeddingManagerToken rejects a non-string value", () => {
    expect(isEmbeddingManagerToken(12345)).toBe(false);
    expect(isEmbeddingManagerToken(undefined)).toBe(false);
    expect(isEmbeddingManagerToken(null)).toBe(false);
  });

  it("isEmbeddingManagerToken rejects an empty string", () => {
    expect(isEmbeddingManagerToken("")).toBe(false);
  });
});
