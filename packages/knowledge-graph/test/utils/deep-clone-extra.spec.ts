import { describe, expect, it } from "vitest";

import { deepClone } from "../../src/utils/deep-clone.js";

describe("deepClone — additional structural cases", () => {
  it("deep-clones a Map nested inside a plain object", () => {
    const original = { m: new Map([["k", 1]]) };
    const clone = deepClone(original);
    expect(clone.m).toBeInstanceOf(Map);
    expect(clone.m.get("k")).toBe(1);
    expect(clone.m).not.toBe(original.m);
  });

  it("deep-clones a Set nested inside an array", () => {
    const original = [new Set([1, 2, 3])];
    const clone = deepClone(original);
    expect(clone[0]).toBeInstanceOf(Set);
    expect(Array.from(clone[0]!)).toEqual([1, 2, 3]);
  });

  it("handles an empty object and empty array", () => {
    expect(deepClone({})).toEqual({});
    expect(deepClone([])).toEqual([]);
  });

  it("handles deeply nested structures without losing data", () => {
    const original = { a: { b: { c: [1, 2, { d: "e" }] } } };
    const clone = deepClone(original);
    expect(clone).toEqual(original);
    expect(clone.a.b.c).not.toBe(original.a.b.c);
  });

  it("preserves numeric and boolean leaf values through nesting", () => {
    const original = { count: 5, active: true, tags: ["x", "y"] };
    const clone = deepClone(original);
    expect(clone.count).toBe(5);
    expect(clone.active).toBe(true);
    expect(clone.tags).toEqual(["x", "y"]);
  });
});
