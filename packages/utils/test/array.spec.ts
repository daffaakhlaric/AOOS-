import { describe, expect, it } from "vitest";

import { chunk, groupBy, unique } from "../src/array.js";

describe("chunk", () => {
  it("splits an array into fixed-size chunks", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("throws for a non-positive size", () => {
    expect(() => chunk([1, 2], 0)).toThrow(RangeError);
  });
});

describe("unique", () => {
  it("removes duplicates preserving first-occurrence order", () => {
    expect(unique([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
  });
});

describe("groupBy", () => {
  it("groups items by a derived key", () => {
    const groups = groupBy(["hot", "hi", "cold", "cat"], (s) => s[0]);
    expect(groups.get("h")).toEqual(["hot", "hi"]);
    expect(groups.get("c")).toEqual(["cold", "cat"]);
  });
});
