import { describe, expect, it } from "vitest";

import { ExecutionPlanId } from "../../../../src/domain/value-objects/ExecutionPlanId.js";

describe("ExecutionPlanId", () => {
  it("generates a valid UUID-backed id", () => {
    expect(ExecutionPlanId.generate().toString()).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("creates from a valid UUID string", () => {
    expect(ExecutionPlanId.create("11111111-1111-4111-8111-111111111111").ok).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    expect(ExecutionPlanId.create("nope").ok).toBe(false);
  });

  it("equals compares by value", () => {
    const raw = "33333333-3333-4333-8333-333333333333";
    const a = ExecutionPlanId.create(raw);
    const b = ExecutionPlanId.create(raw);
    expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
  });
});
