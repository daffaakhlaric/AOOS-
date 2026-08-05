import { describe, expect, it } from "vitest";

import { deepClone, isNil, omitNil, pick } from "../src/object.js";

describe("deepClone", () => {
  it("produces a deep copy with no shared references", () => {
    const original = { a: { b: 1 } };
    const clone = deepClone(original);
    clone.a.b = 2;
    expect(original.a.b).toBe(1);
  });
});

describe("isNil", () => {
  it("identifies null and undefined only", () => {
    expect(isNil(null)).toBe(true);
    expect(isNil(undefined)).toBe(true);
    expect(isNil(0)).toBe(false);
    expect(isNil("")).toBe(false);
  });
});

describe("omitNil", () => {
  it("strips null/undefined-valued keys", () => {
    expect(omitNil({ a: 1, b: null, c: undefined, d: 0 })).toEqual({ a: 1, d: 0 });
  });
});

describe("pick", () => {
  it("selects only the requested keys", () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ["a", "c"])).toEqual({ a: 1, c: 3 });
  });
});
