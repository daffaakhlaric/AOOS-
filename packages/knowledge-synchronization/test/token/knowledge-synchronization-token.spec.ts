import { describe, expect, it } from "vitest";

import {
  generateKnowledgeSynchronizationToken,
  isKnowledgeSynchronizationToken,
} from "../../src/token/knowledge-synchronization-token.js";

describe("KnowledgeSynchronizationToken", () => {
  it("generates a token prefixed with stok_", () => {
    const token = generateKnowledgeSynchronizationToken();
    expect(token.startsWith("stok_")).toBe(true);
  });

  it("generates unique tokens", () => {
    expect(generateKnowledgeSynchronizationToken()).not.toBe(
      generateKnowledgeSynchronizationToken(),
    );
  });

  it("recognizes a well-formed token", () => {
    expect(isKnowledgeSynchronizationToken(generateKnowledgeSynchronizationToken())).toBe(true);
  });

  it("rejects a malformed token", () => {
    expect(isKnowledgeSynchronizationToken("not-a-token")).toBe(false);
  });

  it("rejects a token with the wrong prefix", () => {
    expect(isKnowledgeSynchronizationToken("rtok_11111111-1111-4111-8111-111111111111")).toBe(
      false,
    );
  });

  it("rejects a non-string value", () => {
    expect(isKnowledgeSynchronizationToken(42)).toBe(false);
  });
});
