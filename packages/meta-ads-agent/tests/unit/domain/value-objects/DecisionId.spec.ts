import { describe, expect, it } from "vitest";

import { DecisionId } from "../../../../src/domain/value-objects/DecisionId.js";

describe("DecisionId", () => {
  it("generates a valid UUID-backed id", () => {
    const id = DecisionId.generate();
    expect(id.toString()).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("creates from a valid UUID string", () => {
    const result = DecisionId.create("11111111-1111-4111-8111-111111111111");
    expect(result.ok).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    const result = DecisionId.create("not-a-uuid");
    expect(result.ok).toBe(false);
  });

  it("equals compares by value", () => {
    const raw = "22222222-2222-4222-8222-222222222222";
    const a = DecisionId.create(raw);
    const b = DecisionId.create(raw);
    expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
  });

  it("two generated ids are not equal", () => {
    const a = DecisionId.generate();
    const b = DecisionId.generate();
    expect(a.equals(b)).toBe(false);
  });
});
