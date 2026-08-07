import { describe, expect, it } from "vitest";

import { generateId } from "../../src/utils/id.js";

describe("generateId", () => {
  it("generates a non-empty string", () => {
    expect(generateId().length).toBeGreaterThan(0);
  });

  it("generates unique ids across calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateId()));
    expect(ids.size).toBe(50);
  });

  it("generates a well-formed UUID", () => {
    expect(generateId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
