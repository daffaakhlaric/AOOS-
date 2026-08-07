import { describe, expect, it } from "vitest";

import { generateId } from "../../src/utils/id.js";

describe("generateId", () => {
  it("returns a non-empty string", () => {
    expect(generateId().length).toBeGreaterThan(0);
  });

  it("returns unique values on successive calls", () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
  });

  it("returns a well-formed UUID", () => {
    expect(generateId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
