import { describe, expect, it } from "vitest";

import { deepClone } from "../../src/utils/deep-clone.js";

describe("deepClone", () => {
  it("returns primitives unchanged", () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone("text")).toBe("text");
    expect(deepClone(true)).toBe(true);
    expect(deepClone(null)).toBe(null);
    expect(deepClone(undefined)).toBe(undefined);
  });

  it("deep-clones plain objects (no shared references)", () => {
    const original = { a: 1, nested: { b: 2 } };
    const clone = deepClone(original);
    expect(clone).toEqual(original);
    expect(clone).not.toBe(original);
    expect(clone.nested).not.toBe(original.nested);
  });

  it("deep-clones arrays", () => {
    const original = [1, { x: 2 }, [3, 4]];
    const clone = deepClone(original);
    expect(clone).toEqual(original);
    expect(clone).not.toBe(original);
    expect(clone[1]).not.toBe(original[1]);
  });

  it("deep-clones Maps, including keys and values", () => {
    const original = new Map([["k", { v: 1 }]]);
    const clone = deepClone(original);
    expect(clone).toBeInstanceOf(Map);
    expect(clone.get("k")).toEqual({ v: 1 });
    expect(clone.get("k")).not.toBe(original.get("k"));
  });

  it("deep-clones Sets", () => {
    const original = new Set([{ v: 1 }]);
    const clone = deepClone(original);
    expect(clone).toBeInstanceOf(Set);
    expect(clone.size).toBe(1);
    expect(Array.from(clone)[0]).toEqual({ v: 1 });
    expect(Array.from(clone)[0]).not.toBe(Array.from(original)[0]);
  });

  it("mutating the clone does not affect the original", () => {
    const original = { list: [1, 2, 3] };
    const clone = deepClone(original);
    clone.list.push(4);
    expect(original.list).toEqual([1, 2, 3]);
  });
});
