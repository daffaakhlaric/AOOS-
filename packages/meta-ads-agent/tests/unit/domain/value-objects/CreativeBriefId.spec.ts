import { describe, expect, it } from "vitest";

import { CreativeBriefId } from "../../../../src/domain/value-objects/CreativeBriefId.js";

describe("CreativeBriefId", () => {
  it("generates a valid UUID-backed id", () => {
    expect(CreativeBriefId.generate().toString()).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("creates from a valid UUID string", () => {
    expect(CreativeBriefId.create("11111111-1111-4111-8111-111111111111").ok).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    expect(CreativeBriefId.create("nope").ok).toBe(false);
  });

  it("equals compares by value", () => {
    const raw = "44444444-4444-4444-8444-444444444444";
    const a = CreativeBriefId.create(raw);
    const b = CreativeBriefId.create(raw);
    expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
  });
});
