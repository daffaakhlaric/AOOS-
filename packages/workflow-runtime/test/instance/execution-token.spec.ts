import { describe, expect, it } from "vitest";

import { generateExecutionToken, isExecutionToken } from "../../src/instance/execution-token.js";

describe("ExecutionToken", () => {
  it("generates a prefixed, structurally valid token", () => {
    const token = generateExecutionToken();
    expect(token.startsWith("wtok_")).toBe(true);
    expect(isExecutionToken(token)).toBe(true);
  });

  it("generates a different token on each call", () => {
    expect(generateExecutionToken()).not.toBe(generateExecutionToken());
  });

  it("rejects malformed tokens", () => {
    expect(isExecutionToken("not-a-token")).toBe(false);
    expect(isExecutionToken("wtok_not-a-uuid")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isExecutionToken(42)).toBe(false);
    expect(isExecutionToken(undefined)).toBe(false);
  });
});
