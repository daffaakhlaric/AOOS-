import { describe, expect, it } from "vitest";

import { generateId } from "../../src/utils/id.js";

describe("generateId", () => {
  it("returns a well-formed UUID", () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("returns a fresh value on every call", () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
  });

  it("returns a string type", () => {
    expect(typeof generateId()).toBe("string");
  });

  it("generates a large batch of unique ids", () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateId()));
    expect(ids.size).toBe(200);
  });
});
