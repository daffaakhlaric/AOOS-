import { describe, expect, it } from "vitest";

import { generateId } from "../../src/utils/id.js";

describe("utils — generateId", () => {
  it("generates a v4-shaped UUID string", () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("generates a different value on each call", () => {
    expect(generateId()).not.toBe(generateId());
  });
});
