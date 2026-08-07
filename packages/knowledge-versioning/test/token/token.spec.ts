import { describe, expect, it } from "vitest";

import {
  generateKnowledgeVersionToken,
  isKnowledgeVersionToken,
} from "../../src/token/knowledge-version-token.js";

describe("KnowledgeVersionToken", () => {
  it("generates a kver_-prefixed token", () => {
    const token = generateKnowledgeVersionToken();
    expect(token.startsWith("kver_")).toBe(true);
    expect(isKnowledgeVersionToken(token)).toBe(true);
  });

  it("rejects non-token strings", () => {
    expect(isKnowledgeVersionToken("not-a-token")).toBe(false);
    expect(isKnowledgeVersionToken("ptok_00000000-0000-4000-8000-000000000000")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isKnowledgeVersionToken(123)).toBe(false);
    expect(isKnowledgeVersionToken(undefined)).toBe(false);
    expect(isKnowledgeVersionToken(null)).toBe(false);
  });

  it("generates unique tokens across calls", () => {
    const a = generateKnowledgeVersionToken();
    const b = generateKnowledgeVersionToken();
    expect(a).not.toBe(b);
  });
});
