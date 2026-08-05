import { describe, expect, it } from "vitest";

import {
  generateKnowledgeRuntimeToken,
  isKnowledgeRuntimeToken,
} from "../../src/token/knowledge-runtime-token.js";

describe("Token Test — KnowledgeRuntimeToken", () => {
  it("generateKnowledgeRuntimeToken() produces a ktok_-prefixed UUID", () => {
    const token = generateKnowledgeRuntimeToken();
    expect(token.startsWith("ktok_")).toBe(true);
    expect(isKnowledgeRuntimeToken(token)).toBe(true);
  });

  it("generateKnowledgeRuntimeToken() produces distinct tokens", () => {
    expect(generateKnowledgeRuntimeToken()).not.toBe(generateKnowledgeRuntimeToken());
  });

  it("isKnowledgeRuntimeToken() rejects a non-string", () => {
    expect(isKnowledgeRuntimeToken(123)).toBe(false);
    expect(isKnowledgeRuntimeToken(undefined)).toBe(false);
  });

  it("isKnowledgeRuntimeToken() rejects a malformed string", () => {
    expect(isKnowledgeRuntimeToken("not-a-token")).toBe(false);
    expect(isKnowledgeRuntimeToken("wtok_12345678-1234-4123-8123-123456789012")).toBe(false);
  });
});
