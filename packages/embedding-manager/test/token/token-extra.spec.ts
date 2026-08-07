import { describe, expect, it } from "vitest";

import {
  generateEmbeddingManagerToken,
  isEmbeddingManagerToken,
} from "../../src/token/embedding-manager-token.js";

describe("EmbeddingManagerToken — extra scenarios", () => {
  it("100 generated tokens are all unique", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateEmbeddingManagerToken()));
    expect(tokens.size).toBe(100);
  });

  it("every generated token passes isEmbeddingManagerToken", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(isEmbeddingManagerToken(generateEmbeddingManagerToken())).toBe(true);
    }
  });

  it("rejects a token missing the trailing UUID segment", () => {
    expect(isEmbeddingManagerToken("embt_")).toBe(false);
  });

  it("accepts a token with an uppercase-but-matching prefix (pattern is case-insensitive, matching sibling packages)", () => {
    expect(isEmbeddingManagerToken("EMBT_11111111-1111-4111-8111-111111111111")).toBe(true);
  });

  it("rejects a token with a completely different prefix", () => {
    expect(isEmbeddingManagerToken("xmbt_11111111-1111-4111-8111-111111111111")).toBe(false);
  });

  it("rejects an object value", () => {
    expect(isEmbeddingManagerToken({})).toBe(false);
  });

  it("rejects an array value", () => {
    expect(isEmbeddingManagerToken([])).toBe(false);
  });

  it("rejects a boolean value", () => {
    expect(isEmbeddingManagerToken(true)).toBe(false);
  });
});
