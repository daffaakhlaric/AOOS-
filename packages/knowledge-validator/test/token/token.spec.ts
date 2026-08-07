import { describe, expect, it } from "vitest";

import {
  generateKnowledgeValidatorToken,
  isKnowledgeValidatorToken,
} from "../../src/token/knowledge-validator-token.js";

describe("KnowledgeValidatorToken", () => {
  it("generates a token with the kval_ prefix", () => {
    expect(generateKnowledgeValidatorToken()).toMatch(/^kval_/);
  });

  it("generates unique tokens", () => {
    expect(generateKnowledgeValidatorToken()).not.toBe(generateKnowledgeValidatorToken());
  });

  it("recognizes a well-formed token", () => {
    expect(isKnowledgeValidatorToken(generateKnowledgeValidatorToken())).toBe(true);
  });

  it("rejects a token with the wrong prefix", () => {
    expect(isKnowledgeValidatorToken("kqua_123")).toBe(false);
  });

  it("rejects a non-UUID suffix", () => {
    expect(isKnowledgeValidatorToken("kval_not-a-uuid")).toBe(false);
  });

  it("rejects a non-string value", () => {
    expect(isKnowledgeValidatorToken(42)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isKnowledgeValidatorToken(undefined)).toBe(false);
  });

  it("rejects null", () => {
    expect(isKnowledgeValidatorToken(null)).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isKnowledgeValidatorToken("")).toBe(false);
  });

  it("accepts uppercase hex UUID characters", () => {
    const token = generateKnowledgeValidatorToken().toUpperCase().replace("KVAL_", "kval_");
    expect(isKnowledgeValidatorToken(token)).toBe(true);
  });
});
