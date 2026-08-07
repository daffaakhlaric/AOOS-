import { describe, expect, it } from "vitest";

import {
  generateKnowledgeQualityToken,
  isKnowledgeQualityToken,
} from "../../src/token/knowledge-quality-token.js";

describe("KnowledgeQualityToken", () => {
  it("generates a token prefixed with kqua_", () => {
    const token = generateKnowledgeQualityToken();
    expect(token.startsWith("kqua_")).toBe(true);
  });

  it("generates unique tokens", () => {
    const a = generateKnowledgeQualityToken();
    const b = generateKnowledgeQualityToken();
    expect(a).not.toBe(b);
  });

  it("recognizes a generated token as valid", () => {
    expect(isKnowledgeQualityToken(generateKnowledgeQualityToken())).toBe(true);
  });

  it("rejects a token with the wrong prefix", () => {
    expect(isKnowledgeQualityToken("kmkt_00000000-0000-4000-8000-000000000000")).toBe(false);
  });

  it("rejects a malformed UUID suffix", () => {
    expect(isKnowledgeQualityToken("kqua_not-a-uuid")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isKnowledgeQualityToken(12345)).toBe(false);
    expect(isKnowledgeQualityToken(undefined)).toBe(false);
    expect(isKnowledgeQualityToken(null)).toBe(false);
    expect(isKnowledgeQualityToken({})).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isKnowledgeQualityToken("")).toBe(false);
  });

  it("accepts uppercase hex digits", () => {
    const token = generateKnowledgeQualityToken().toUpperCase();
    expect(isKnowledgeQualityToken(token.replace("KQUA_", "kqua_"))).toBe(true);
  });
});
