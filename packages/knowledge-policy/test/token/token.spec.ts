import { describe, expect, it } from "vitest";

import {
  generateKnowledgePolicyToken,
  isKnowledgePolicyToken,
} from "../../src/token/knowledge-policy-token.js";

describe("generateKnowledgePolicyToken", () => {
  it("generates a token prefixed with kpol_", () => {
    const token = generateKnowledgePolicyToken();
    expect(token.startsWith("kpol_")).toBe(true);
  });

  it("generates unique tokens", () => {
    expect(generateKnowledgePolicyToken()).not.toBe(generateKnowledgePolicyToken());
  });
});

describe("isKnowledgePolicyToken", () => {
  it("accepts a well-formed generated token", () => {
    expect(isKnowledgePolicyToken(generateKnowledgePolicyToken())).toBe(true);
  });

  it("rejects a malformed string", () => {
    expect(isKnowledgePolicyToken("not-a-token")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isKnowledgePolicyToken(123)).toBe(false);
    expect(isKnowledgePolicyToken(undefined)).toBe(false);
    expect(isKnowledgePolicyToken(null)).toBe(false);
    expect(isKnowledgePolicyToken({})).toBe(false);
  });

  it("rejects a token with the wrong prefix", () => {
    const token = generateKnowledgePolicyToken().replace("kpol_", "kver_");
    expect(isKnowledgePolicyToken(token)).toBe(false);
  });
});
