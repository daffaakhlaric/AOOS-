import { describe, expect, it } from "vitest";

import { DecisionReason } from "../../../../src/domain/value-objects/DecisionReason.js";

describe("DecisionReason", () => {
  it("creates from a non-empty string", () => {
    const result = DecisionReason.create("rphChat too high");
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.toString()).toBe("rphChat too high");
  });

  it("rejects an empty string", () => {
    expect(DecisionReason.create("").ok).toBe(false);
  });

  it("rejects a whitespace-only string", () => {
    expect(DecisionReason.create("   ").ok).toBe(false);
  });

  it("equals compares by text", () => {
    const a = DecisionReason.create("same");
    const b = DecisionReason.create("same");
    expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
  });

  it("equals returns false for different text", () => {
    const a = DecisionReason.create("a");
    const b = DecisionReason.create("b");
    expect(a.ok && b.ok && a.value.equals(b.value)).toBe(false);
  });
});
