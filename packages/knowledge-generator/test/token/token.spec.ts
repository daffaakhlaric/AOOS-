import { describe, expect, it } from "vitest";

import {
  generateKnowledgeGeneratorToken,
  isKnowledgeGeneratorToken,
} from "../../src/token/knowledge-generator-token.js";

describe("KnowledgeGeneratorToken", () => {
  it("generates a token prefixed with kgen_", () => {
    const token = generateKnowledgeGeneratorToken();
    expect(token.startsWith("kgen_")).toBe(true);
  });

  it("generates unique tokens", () => {
    const a = generateKnowledgeGeneratorToken();
    const b = generateKnowledgeGeneratorToken();
    expect(a).not.toBe(b);
  });

  it("recognizes a generated token as valid", () => {
    expect(isKnowledgeGeneratorToken(generateKnowledgeGeneratorToken())).toBe(true);
  });

  it("rejects a token with the wrong prefix", () => {
    expect(isKnowledgeGeneratorToken("kmkt_00000000-0000-4000-8000-000000000000")).toBe(false);
  });

  it("rejects a malformed UUID suffix", () => {
    expect(isKnowledgeGeneratorToken("kgen_not-a-uuid")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isKnowledgeGeneratorToken(12345)).toBe(false);
    expect(isKnowledgeGeneratorToken(undefined)).toBe(false);
    expect(isKnowledgeGeneratorToken(null)).toBe(false);
    expect(isKnowledgeGeneratorToken({})).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isKnowledgeGeneratorToken("")).toBe(false);
  });

  it("accepts uppercase hex digits", () => {
    const token = generateKnowledgeGeneratorToken().toUpperCase();
    expect(isKnowledgeGeneratorToken(token.replace("KGEN_", "kgen_"))).toBe(true);
  });
});
